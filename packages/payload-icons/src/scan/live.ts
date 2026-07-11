import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { extractIconUsages } from './extract'
import type { IconUsage, IconUsageManifest, LiveScanOptions } from '../types'

/**
 * In-process icon-usage scan — the bundler-safe counterpart of the CLI's
 * {@link file://./index.ts | scanIconUsages}. Same fs walk + parser, but with
 * EXTENSIONLESS relative imports (`./extract`, not `./extract.js`) so it bundles
 * cleanly into the Next-rendered admin panel; `./index.ts` keeps `.js`
 * specifiers for the raw-Node CLI, which a bundler can't map back to `.ts`.
 *
 * This is what lets the "Requested icons" panel scan source **live in dev** — so
 * seeing what the code needs requires no build step, CLI, or manifest. (In
 * production the source isn't on disk, so the panel reads the CLI-written
 * manifest instead.)
 */

const DEFAULT_EXTENSIONS = ['tsx', 'jsx', 'ts', 'js', 'mdx']
const DEFAULT_IGNORE = ['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo']
const DEFAULT_ROOTS = ['src', 'app']

const toPosix = (p: string): string => p.split(sep).join('/')

/** Recursively collect scannable file paths under `dir`. */
const walk = (dir: string, exts: Set<string>, ignore: Set<string>, out: string[]): void => {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return // unreadable/missing — skip
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ignore.has(entry.name)) walk(full, exts, ignore, out)
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.')
      if (dot !== -1 && exts.has(entry.name.slice(dot + 1))) out.push(full)
    }
  }
}

/**
 * Scan the source tree and return a manifest — the same shape the CLI writes,
 * built in memory. Returns an empty manifest (no throw) when the roots don't
 * exist, so it's safe to call at admin-render time.
 */
export const scanIconUsagesLive = (options: LiveScanOptions = {}): IconUsageManifest => {
  const cwd = options.cwd ?? process.cwd()
  const roots = options.roots?.length ? options.roots : DEFAULT_ROOTS
  const exts = new Set((options.extensions?.length ? options.extensions : DEFAULT_EXTENSIONS).map((e) => e.replace(/^\./, '')))
  const ignore = new Set(options.ignore?.length ? options.ignore : DEFAULT_IGNORE)

  const files: string[] = []
  for (const root of roots) {
    const abs = isAbsolute(root) ? root : resolve(cwd, root)
    let stat: ReturnType<typeof statSync> | null = null
    try {
      stat = statSync(abs)
    } catch {
      continue // missing root — skip
    }
    if (stat.isDirectory()) walk(abs, exts, ignore, files)
    else if (stat.isFile()) files.push(abs)
  }

  const usages: IconUsage[] = []
  for (const file of files) {
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const rel = toPosix(relative(cwd, file))
    for (const u of extractIconUsages(source, { components: options.components })) {
      usages.push({ name: u.name, file: rel, line: u.line, column: u.column })
    }
  }

  // Deterministic ordering, matching the CLI manifest.
  usages.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  const names = [...new Set(usages.map((u) => u.name))].sort((a, b) => a.localeCompare(b))
  return { version: 1, generatedAt: new Date().toISOString(), names, usages }
}
