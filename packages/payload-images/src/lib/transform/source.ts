/**
 * Read the raw bytes of an upload doc — local disk, the storage adapter's handlers, or a URL
 * fetch — with a path-traversal guard on the local read and an SSRF guard on the remote fetch.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLocalReq, type Payload } from 'payload'

import type { UploadDocLike, UploadHandler } from '../../types'

const MAX_FETCH_BYTES = 64 * 1024 * 1024

/** True for hostnames in loopback / private / link-local space (the SSRF sinks). */
const isPrivateHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::1') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }
  return /^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)
}

/** SSRF guard: always allow the configured server origin itself (self-fetching Payload's own
 *  static route must work, even on localhost in dev); otherwise refuse private hosts. */
const isAllowedFetchTarget = (target: URL, trusted: URL | null): boolean => {
  if (trusted && target.host === trusted.host) return true
  return !isPrivateHost(target.hostname)
}

/**
 * Read the bytes through the collection's storage-adapter `upload.handlers` (Vercel Blob, S3, …)
 * — the same server-side path Payload's own file route takes after its access check, invoked
 * directly so it needs no origin, cookie, or open read access. (The self-fetch fallback can't
 * serve an access-controlled collection like `generated-images`: its unauthenticated request
 * 403s and every variant read becomes a cache miss.)
 */
const readViaStorageHandlers = async (payload: Payload, slug: string, doc: UploadDocLike): Promise<Buffer | null> => {
  const collections = payload.collections as Record<string, { config?: { upload?: { handlers?: UploadHandler[] } } }> //EXCUSE: indexes the app's generated slug map by a runtime string; only the probed shape is claimed
  const handlers = collections?.[slug]?.config?.upload?.handlers
  if (!handlers?.length || !doc.filename) return null
  try {
    const req = await createLocalReq({}, payload)
    for (const handler of handlers) {
      const res = await handler(req, { doc, params: { collection: slug, filename: doc.filename, prefix: doc.prefix ?? undefined } })
      if (res instanceof Response) return res.ok ? Buffer.from(await res.arrayBuffer()) : null
    }
  } catch {}
  return null
}

/**
 * Read an upload's bytes, in order: the local file under `staticDir`, the storage-adapter
 * handlers (pass `via`), the doc's absolute URL, or its relative URL resolved against `baseUrl`
 * (self-fetching Payload's static file route). Null when nothing yields bytes.
 */
export const readBytes = async (
  doc: UploadDocLike,
  staticDir: string,
  baseUrl?: string,
  via?: { payload: Payload; slug: string },
): Promise<Buffer | null> => {
  if (doc.filename) {
    const base = path.resolve(staticDir)
    const filePath = path.resolve(base, doc.filename)
    // Async read — a sync read of a multi-MB original blocks the event loop on the serving path.
    // ENOENT falls through to the storage-adapter / URL branches (the original miss behavior).
    if (filePath === base || filePath.startsWith(base + path.sep)) {
      try {
        return await fs.readFile(filePath)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }
  }

  if (via) {
    const bytes = await readViaStorageHandlers(via.payload, via.slug, doc)
    if (bytes) return bytes
  }

  if (typeof doc.url === 'string' && doc.url) {
    const isAbsolute = /^https?:\/\//i.test(doc.url)
    const base = (baseUrl ?? '').replace(/\/$/, '')
    const targetStr = isAbsolute ? doc.url : base ? `${base}${doc.url.startsWith('/') ? '' : '/'}${doc.url}` : ''
    if (/^https?:\/\//i.test(targetStr)) {
      let target: URL
      let trusted: URL | null = null
      try {
        target = new URL(targetStr)
      } catch {
        return null
      }
      try {
        trusted = base ? new URL(base) : null
      } catch {}
      if (!isAllowedFetchTarget(target, trusted)) return null
      try {
        const res = await fetch(targetStr, { signal: AbortSignal.timeout(15_000), redirect: 'manual' })
        if (!res.ok) return null
        const declared = Number(res.headers?.get?.('content-length') ?? '')
        if (Number.isFinite(declared) && declared > MAX_FETCH_BYTES) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return buf.byteLength > MAX_FETCH_BYTES ? null : buf
      } catch {}
    }
  }
  return null
}
