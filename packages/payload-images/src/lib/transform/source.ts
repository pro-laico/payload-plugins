import path from 'node:path'
import fs from 'node:fs/promises'
import { createLocalReq, type Payload } from 'payload'

import { isRecord } from '../isRecord'
import type { UploadDocLike, UploadHandler } from '../../types'

const MAX_FETCH_BYTES = 64 * 1024 * 1024

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

const isAllowedFetchTarget = (target: URL, trusted: URL | null): boolean => {
  if (trusted && target.host === trusted.host) return true
  return !isPrivateHost(target.hostname)
}

const readViaStorageHandlers = async (payload: Payload, slug: string, doc: UploadDocLike): Promise<Buffer | null> => {
  //EXCUSE: the plugin invokes storage handlers with a light UploadDocLike for a runtime-configured collection; Payload's handler type demands that collection's full generated doc (with id)
  const handlers = payload.collections[slug]?.config?.upload?.handlers as UploadHandler[] | undefined
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

export const readBytes = async (
  doc: UploadDocLike,
  staticDir: string,
  baseUrl?: string,
  via?: { payload: Payload; slug: string },
): Promise<Buffer | null> => {
  if (doc.filename) {
    const base = path.resolve(staticDir)
    const filePath = path.resolve(base, doc.filename)
    if (filePath === base || filePath.startsWith(base + path.sep)) {
      try {
        return await fs.readFile(filePath)
      } catch (err) {
        if (!(isRecord(err) && err.code === 'ENOENT')) throw err
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
