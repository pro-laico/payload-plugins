import path from 'node:path'
import fs from 'node:fs/promises'
import { createLocalReq, type Payload } from 'payload'

import { isRecord } from '../../_kit'
import type { UploadDocLike, UploadHandler } from '../../types'

const MAX_FETCH_BYTES = 64 * 1024 * 1024

const isPrivateIPv4 = (ip: string): boolean => {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

// An IPv4 address smuggled inside an IPv6 literal (::ffff:169.254.169.254, ::ffff:a9fe:a9fe,
// ::169.254.169.254), which the OS routes to the mapped IPv4 — normalized so the IPv4 ranges apply.
const embeddedIPv4 = (h: string): string | undefined => {
  const dotted = h.match(/^(?:::|(?:0{1,4}:){1,6})(?:ffff:)?((?:\d{1,3}\.){3}\d{1,3})$/)
  if (dotted) return dotted[1]
  // Hex tails: mapped (::ffff:a9fe:a9fe) and the deprecated IPv4-compatible ::/96 block
  // (::7f00:1) — the form URL parsing normalizes dotted literals into.
  const hex = h.match(/^(?:::|(?:0{1,4}:){1,6})(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hex) return undefined
  const hi = Number.parseInt(hex[1] ?? '', 16)
  const lo = Number.parseInt(hex[2] ?? '', 16)
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
}

// Literal-address guard only: a hostname that DNS-resolves to a private address is not caught here.
// Source URLs come from the app's own storage config (not attacker-set), so DNS pinning is out of scope.
const isPrivateHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::' || h === '::1') return true
  if (isPrivateIPv4(h)) return true
  const mapped = embeddedIPv4(h)
  if (mapped && isPrivateIPv4(mapped)) return true
  return /^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)
}

const isAllowedFetchTarget = (target: URL, trusted: URL | null): boolean => {
  if (trusted && target.host === trusted.host) return true
  return !isPrivateHost(target.hostname)
}

const readViaStorageHandlers = async (payload: Payload, slug: string, doc: UploadDocLike): Promise<Buffer | null> => {
  //EXCUSE: the plugin reads a runtime-configured collection's storage handlers with a light UploadDocLike (no guaranteed id, since URL/file paths don't need one); Payload's handler type demands the full doc with id
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
