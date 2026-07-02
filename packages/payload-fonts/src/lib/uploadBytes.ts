import fs from 'node:fs'
import path from 'node:path'

import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

/** The readable slice of any upload doc: a local filename and/or a URL (plus the
 *  cloud-storage `prefix` when the adapter stores one). */
export type UploadDoc = { filename?: string | null; url?: string | null; prefix?: string | null }

type UploadHandler = (
  req: PayloadRequest,
  args: { doc: unknown; headers?: Headers; params: { collection: string; filename: string; prefix?: string } },
  // biome-ignore lint/suspicious/noConfusingVoidType: mirrors Payload's upload handler signature, which returns void
) => Promise<Response | void> | Response | void

/** Resolve a collection's on-disk `staticDir` (absolute), defaulting to its slug. */
const resolveStaticDir = (payload: Payload, slug: string): string => {
  const collections = payload.collections as Record<string, { config?: { upload?: { staticDir?: string } } }>
  const dir = collections?.[slug]?.config?.upload?.staticDir
  const base = dir?.length ? dir : slug
  return path.isAbsolute(base) ? base : path.resolve(process.cwd(), base)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Read the bytes through the collection's storage-adapter `upload.handlers` (Vercel Blob, S3, …).
 * This is the same server-side path Payload's own file route takes after its access check —
 * invoked directly, not over HTTP, so it needs no origin, cookie, or open read access.
 *
 * Only a 200 with a non-empty body counts as success. Cloud storage is eventually consistent on
 * read-after-write: fetching a blob moments after it was (re)uploaded can miss — the Vercel Blob
 * adapter surfaces that as an ok-looking **204 with an empty body** (its `head()` sees the new
 * metadata but the CDN fetch behind it isn't propagated yet). That's transient, so retry briefly
 * before giving up. Without this, a seed run subsets 0-byte "fonts" and fails downstream.
 */
async function readViaStorageHandlers(payload: Payload, slug: string, doc: UploadDoc): Promise<Buffer | null> {
  const collections = payload.collections as Record<string, { config?: { upload?: { handlers?: UploadHandler[] } } }>
  const handlers = collections?.[slug]?.config?.upload?.handlers
  if (!handlers?.length || !doc.filename) return null
  const ATTEMPTS = 4
  const RETRY_DELAY_MS = 1500
  try {
    const req = await createLocalReq({}, payload)
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAY_MS)
      for (const handler of handlers) {
        const res = await handler(req, { doc, params: { collection: slug, filename: doc.filename, prefix: doc.prefix ?? undefined } })
        if (!(res instanceof Response)) continue
        if (res.status !== 200) continue // 204/304/4xx — not (yet) readable through this path
        const bytes = Buffer.from(await res.arrayBuffer())
        if (bytes.byteLength > 0) return bytes
      }
    }
  } catch {
    // fall through to the URL fetch
  }
  return null
}

/**
 * Read an upload document's bytes regardless of storage adapter. In order:
 *  1. the local file under the collection's `staticDir` (local-disk storage),
 *  2. the collection's storage-adapter `upload.handlers`, invoked directly (cloud storage —
 *     no HTTP and no access control, exactly like Payload's own file route post-auth), or
 *  3. the URL the doc reports, fetched — an absolute cloud URL as-is, a relative one (Payload's
 *     access-controlled file route) resolved against `serverURL`.
 *
 * Returns `null` when nothing yields the bytes.
 *
 * `opts.headers` are forwarded to the URL fetch — needed only when step 3 hits Payload's own
 * access-controlled file route: a caller running inside an authenticated request passes its
 * `cookie` so the route authorizes the read instead of returning 403.
 */
export async function readUploadBytes(
  payload: Payload,
  slug: string,
  doc: UploadDoc,
  opts: { headers?: Record<string, string> } = {},
): Promise<Buffer | null> {
  if (doc.filename) {
    // Resolve under staticDir and confirm the result stays inside it — guards against
    // path-traversal segments or an absolute path escaping the dir.
    const base = path.resolve(resolveStaticDir(payload, slug))
    const filePath = path.resolve(base, doc.filename)
    if ((filePath === base || filePath.startsWith(base + path.sep)) && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath)
    }
  }

  const viaHandlers = await readViaStorageHandlers(payload, slug, doc)
  if (viaHandlers) return viaHandlers

  if (typeof doc.url === 'string' && doc.url) {
    const isAbsolute = /^https?:\/\//i.test(doc.url)
    const base = (payload.config?.serverURL || '').replace(/\/$/, '')
    const target = isAbsolute ? doc.url : base ? `${base}${doc.url.startsWith('/') ? '' : '/'}${doc.url}` : ''
    if (/^https?:\/\//i.test(target)) {
      try {
        const res = await fetch(target, { headers: opts.headers, signal: AbortSignal.timeout(15_000) })
        if (res.status === 200) {
          const bytes = Buffer.from(await res.arrayBuffer())
          if (bytes.byteLength > 0) return bytes
        }
      } catch {
        // fall through to "not found"
      }
    }
  }
  return null
}
