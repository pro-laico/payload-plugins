import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import type { LiveScanOptions, ScannedGetter } from '../types'
import { extractGetterCalls } from './extract'

/**
 * In-process getter scan (the payload-icons live-scan pattern): walk the app's source
 * and extract every `cacheDoc`/`cacheIds`/`cacheGlobal` call site, so the dev map shows
 * the getters the CODE declares — file, line, enclosing function — before any of them
 * has materialized at runtime. Dev-only (invoked from the inspection getter when
 * `observe` is on; production has no source on disk), and TTL-cached because the
 * toolbar polls the snapshot.
 */

const DEFAULT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']
const DEFAULT_IGNORE = ['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo']
const DEFAULT_ROOTS = ['src', 'app']
const TTL_MS = 5_000

const toPosix = (p: string): string => p.split(sep).join('/')

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

let cached: { at: number; getters: ScannedGetter[] } | null = null

/** Scan (or return the recent cached scan). Never throws — missing roots yield []. */
export const scanGettersLive = (options: LiveScanOptions = {}): ScannedGetter[] => {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.getters

  const cwd = options.cwd ?? process.cwd()
  const exts = new Set(DEFAULT_EXTENSIONS)
  const ignore = new Set(DEFAULT_IGNORE)

  const files: string[] = []
  for (const root of options.roots?.length ? options.roots : DEFAULT_ROOTS) {
    const abs = isAbsolute(root) ? root : resolve(cwd, root)
    let stat: ReturnType<typeof statSync> | null = null
    try {
      stat = statSync(abs)
    } catch {
      continue
    }
    if (stat.isDirectory()) walk(abs, exts, ignore, files)
    else if (stat.isFile()) files.push(abs)
  }

  const getters: ScannedGetter[] = []
  for (const file of files) {
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (!source.includes('cacheDoc') && !source.includes('cacheIds') && !source.includes('cacheGlobal')) continue
    const rel = toPosix(relative(cwd, file))
    for (const call of extractGetterCalls(source)) getters.push({ ...call, file: rel })
  }

  getters.sort((a, b) => a.slug.localeCompare(b.slug) || a.file.localeCompare(b.file) || a.line - b.line)
  cached = { at: Date.now(), getters }
  return getters
}

/** Test helper: drop the TTL cache. */
export const resetGetterScan = (): void => {
  cached = null
}
