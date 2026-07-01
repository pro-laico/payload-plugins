import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join } from 'node:path'
import type { File } from 'payload'

// MIME type derived from the file's real extension — we upload whatever the source is
// (JPEG/PNG/WebP/SVG/WOFF2/…), not an assumed format.
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}

// Extensions eligible for the same-basename sibling fallback in `resolveFilePath` — image formats
// only, where `foo.png` picking up `foo.jpg` is a convenience. Fonts are matched by exact name so a
// requested format is never silently swapped for another.
const TOLERANT_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'])

const stripExt = (name: string) => name.slice(0, name.length - extname(name).length)

/**
 * Resolve a `_file` name to an absolute path on disk. `subdirs` is the ordered list of directories
 * under the assets root to search — typically a collection's subdir then the root (`['media', '']`).
 * The name may include a relative subpath (`portraits/jane.jpg`), resolved under each search dir, so
 * a collection folder can be subdivided further. Tolerates an extension mismatch for image files (a
 * name of `foo.png` picks up `foo.jpg`). Returns null when nothing matches; an absolute name is
 * returned as-is.
 */
export async function resolveFilePath(name: string, assetsRoot: string, subdirs: string[]): Promise<string | null> {
  if (isAbsolute(name)) return name
  const { readdir } = await import('node:fs/promises')
  const nameDir = dirname(name) // '.' for a bare filename, else the subpath (e.g. 'portraits')
  const fileName = basename(name)
  const wantBase = stripExt(fileName)
  for (const sub of subdirs) {
    const dir = join(assetsRoot, sub, nameDir)
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }
    if (entries.includes(fileName)) return join(dir, fileName)
    const sibling = entries.find((e) => stripExt(e) === wantBase && TOLERANT_EXTS.has(extname(e).toLowerCase()))
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
