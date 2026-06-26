import { readdir, readFile } from 'node:fs/promises'
import { extname, isAbsolute, join } from 'node:path'
import type { File, Payload, PayloadRequest } from 'payload'
import type { AssetSpec } from '../types'

// MIME type derived from the file's real extension — we upload whatever the asset
// generator produced (JPEG/PNG/WebP/…), not an assumed format.
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

const baseName = (name: string) => name.slice(0, name.length - extname(name).length)

// Directories under the assets root to search for a spec's file (in order), so a spec
// can name just `service-a.jpg` and the loader finds `assets/image/service-a.jpg`.
const SUBDIRS = ['', 'image', 'images', 'svg', 'font', 'fonts']

/**
 * Resolve a spec filename to an absolute path on disk, searching the assets subdirs and
 * tolerating an extension mismatch (a spec naming `foo.png` picks up `foo.jpg`). Returns
 * null when nothing matches.
 */
async function resolveAssetFile(file: string, assetsRoot: string): Promise<string | null> {
  if (isAbsolute(file)) return file
  const wantBase = baseName(file)
  for (const sub of SUBDIRS) {
    const dir = sub ? join(assetsRoot, sub) : assetsRoot
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }
    if (entries.includes(file)) return join(dir, file)
    const sibling = entries.find((e) => baseName(e) === wantBase && extname(e).toLowerCase() in MIME_BY_EXT)
    if (sibling) return join(dir, sibling)
  }
  return null
}

async function readAssetFile(path: string): Promise<File> {
  const data = await readFile(path)
  const name = path.split(/[\\/]/).pop() ?? path
  const mimetype = MIME_BY_EXT[extname(path).toLowerCase()] ?? 'application/octet-stream'
  return { name, data, mimetype, size: data.byteLength }
}

export interface UploadAssetsArgs {
  payload: Payload
  req: PayloadRequest
  specs: Record<string, AssetSpec>
  assetsRoot: string
  defaultCollection: string
}

/**
 * Upload every declared asset FIRST (after clearing), returning a map of asset key →
 * created upload-doc id. Uploads run SEQUENTIALLY: every create shares one `req`, and
 * Payload assigns the upload to `req.file`, so running them in parallel would race that
 * single slot. A missing source file is logged and skipped — its key stays unresolved,
 * which validation will have already flagged if anything references it.
 */
export async function uploadAssets({
  payload,
  req,
  specs,
  assetsRoot,
  defaultCollection,
}: UploadAssetsArgs): Promise<Map<string, string | number>> {
  const ids = new Map<string, string | number>()
  const baseArgs = { depth: 0, overrideAccess: true, context: { disableRevalidate: true }, req }

  for (const [key, spec] of Object.entries(specs)) {
    const path = await resolveAssetFile(spec.file, assetsRoot)
    if (!path) {
      payload.logger.warn({ msg: `[payload-seed] asset '${key}': file '${spec.file}' not found under ${assetsRoot} — skipped` })
      continue
    }
    const file = await readAssetFile(path)
    const data: Record<string, unknown> = { ...spec.data }
    if (spec.alt !== undefined) data.alt = spec.alt
    if (spec.focalX !== undefined) data.focalX = spec.focalX
    if (spec.focalY !== undefined) data.focalY = spec.focalY
    const collection = spec.collection ?? defaultCollection
    payload.logger.info(`[payload-seed] uploading asset '${key}' → ${collection}/${file.name}`)
    const doc = (await payload.create({ collection: collection as never, data: data as never, file, ...baseArgs })) as { id: string | number }
    ids.set(key, doc.id)
  }
  return ids
}
