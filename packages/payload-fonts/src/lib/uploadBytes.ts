import fs from 'node:fs'
import path from 'node:path'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import type { UploadDoc, UploadHandler } from '../types'

const resolveStaticDir = (payload: Payload, slug: string): string => {
  const dir = payload.collections[slug]?.config?.upload?.staticDir
  const base = dir?.length ? dir : slug
  return path.isAbsolute(base) ? base : path.resolve(process.cwd(), base)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A doc created this recently, in a collection on remote storage, gets the long retry ladder:
// CDN-backed stores (Vercel Blob) document up to ~60s before a fresh upload is readable
// everywhere, and giving up early silently drops the weight. Local-disk collections (no storage
// handlers) and older docs fail fast — there a miss means genuinely missing, not still propagating.
const FRESH_DOC_WINDOW_MS = 2 * 60_000
const FRESH_RETRY_DELAYS_MS = [1_500, 3_000, 6_000, 12_000, 15_000, 15_000, 15_000]
const SETTLED_RETRY_DELAYS_MS = [1_500, 1_500, 1_500]

const isFreshDoc = (doc: UploadDoc): boolean => {
  const createdAtMs = doc.createdAt ? Date.parse(doc.createdAt) : Number.NaN
  return Number.isFinite(createdAtMs) && Date.now() - createdAtMs < FRESH_DOC_WINDOW_MS
}

async function readViaStorageHandlers(payload: Payload, req: PayloadRequest, slug: string, doc: UploadDoc): Promise<Buffer | null> {
  //EXCUSE: the plugin invokes storage handlers with a light UploadDoc for a runtime-configured collection; Payload's handler type demands that collection's full generated doc
  const handlers = payload.collections[slug]?.config?.upload?.handlers as UploadHandler[] | undefined
  if (!handlers?.length || !doc.filename) return null
  try {
    for (const handler of handlers) {
      const res = await handler(req, { doc, params: { collection: slug, filename: doc.filename, prefix: doc.prefix ?? undefined } })
      if (!(res instanceof Response)) continue
      if (res.status !== 200) continue
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.byteLength > 0) return bytes
    }
  } catch {}
  return null
}

// attempt busts any CDN-cached 404 from an earlier round — retrying the identical URL can keep
// hitting the cached miss even after the object has propagated.
async function readViaUrl(
  payload: Payload,
  doc: UploadDoc,
  headers: Record<string, string> | undefined,
  attempt: number,
): Promise<Buffer | null> {
  if (typeof doc.url !== 'string' || !doc.url) return null
  const isAbsolute = /^https?:\/\//i.test(doc.url)
  const base = (payload.config?.serverURL || '').replace(/\/$/, '')
  const target = isAbsolute ? doc.url : base ? `${base}${doc.url.startsWith('/') ? '' : '/'}${doc.url}` : ''
  if (!/^https?:\/\//i.test(target)) return null
  const busted = attempt > 0 ? `${target}${target.includes('?') ? '&' : '?'}retry=${attempt}` : target
  try {
    const res = await fetch(busted, { headers, signal: AbortSignal.timeout(15_000) })
    if (res.status === 200) {
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.byteLength > 0) return bytes
    }
  } catch {}
  return null
}

export async function readUploadBytes(
  payload: Payload,
  slug: string,
  doc: UploadDoc,
  opts: { headers?: Record<string, string> } = {},
): Promise<Buffer | null> {
  if (doc.filename) {
    const base = path.resolve(resolveStaticDir(payload, slug))
    const filePath = path.resolve(base, doc.filename)
    if ((filePath === base || filePath.startsWith(base + path.sep)) && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath)
    }
  }

  const hasStorageHandlers = Boolean(payload.collections[slug]?.config?.upload?.handlers?.length)
  const delays = hasStorageHandlers && isFreshDoc(doc) ? FRESH_RETRY_DELAYS_MS : SETTLED_RETRY_DELAYS_MS
  let req: PayloadRequest | undefined
  try {
    req = await createLocalReq({}, payload)
  } catch {}
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1] ?? 0)
    if (req) {
      const viaHandlers = await readViaStorageHandlers(payload, req, slug, doc)
      if (viaHandlers) return viaHandlers
    }
    const viaUrl = await readViaUrl(payload, doc, opts.headers, attempt)
    if (viaUrl) return viaUrl
  }
  return null
}
