import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, join } from 'node:path'
import type { File } from 'payload'

// MIME type derived from the file's real extension — we upload whatever the source is
// (JPEG/PNG/WebP/SVG/…), not an assumed format.
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

// Directories under the assets root to search for a native upload's file (in order), so a
// record can name just `service-a.jpg` and the loader finds `assets/image/service-a.jpg`.
const NATIVE_SUBDIRS = ['', 'image', 'images', 'svg', 'font', 'fonts']

/**
 * Resolve a `_file` name to an absolute path on disk. A provider passes its `subdir` (searched
 * first, then the root); a native upload searches the built-in subdirs. Tolerates an extension
 * mismatch for image files (a name of `foo.png` picks up `foo.jpg`). Returns null when nothing
 * matches; an absolute name is returned as-is.
 */
export async function resolveFilePath(name: string, assetsRoot: string, subdir?: string): Promise<string | null> {
  if (isAbsolute(name)) return name
  const dirs = subdir !== undefined ? [subdir, ''] : NATIVE_SUBDIRS
  const wantBase = baseName(name)
  const { readdir } = await import('node:fs/promises')
  for (const sub of dirs) {
    const dir = sub ? join(assetsRoot, sub) : assetsRoot
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }
    if (entries.includes(name)) return join(dir, name)
    const sibling = entries.find((e) => baseName(e) === wantBase && extname(e).toLowerCase() in MIME_BY_EXT)
    if (sibling) return join(dir, sibling)
  }
  return null
}

/** Read a resolved path into a Payload `File` (for a native upload's `file` param). */
export async function readFileAsUpload(path: string): Promise<File> {
  const data = await readFile(path)
  const name = path.split(/[\\/]/).pop() ?? path
  const mimetype = MIME_BY_EXT[extname(path).toLowerCase()] ?? 'application/octet-stream'
  return { name, data, mimetype, size: data.byteLength }
}
