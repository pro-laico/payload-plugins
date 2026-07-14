import fs from 'node:fs'
import path from 'node:path'
import { createLocalReq, type Payload } from 'payload'

import type { UploadDoc, UploadHandler } from '../types'

const resolveStaticDir = (payload: Payload, slug: string): string => {
  const dir = payload.collections[slug]?.config?.upload?.staticDir
  const base = dir?.length ? dir : slug
  return path.isAbsolute(base) ? base : path.resolve(process.cwd(), base)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readViaStorageHandlers(payload: Payload, slug: string, doc: UploadDoc): Promise<Buffer | null> {
  //EXCUSE: the plugin invokes storage handlers with a light UploadDoc for a runtime-configured collection; Payload's handler type demands that collection's full generated doc
  const handlers = payload.collections[slug]?.config?.upload?.handlers as UploadHandler[] | undefined
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
        if (res.status !== 200) continue
        const bytes = Buffer.from(await res.arrayBuffer())
        if (bytes.byteLength > 0) return bytes
      }
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
      } catch {}
    }
  }
  return null
}
