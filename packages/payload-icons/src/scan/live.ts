import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs'

import { extractIconUsages } from './extract'
import type { IconUsage, IconUsageManifest, LiveScanOptions } from '../types'

const DEFAULT_EXTENSIONS = ['tsx', 'jsx', 'ts', 'js', 'mdx']
const DEFAULT_IGNORE = ['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo']
const DEFAULT_ROOTS = ['src', 'app']

const toPosix = (p: string): string => p.split(sep).join('/')

const walk = (dir: string, exts: Set<string>, ignore: Set<string>, out: string[]): void => {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
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
      continue
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

  usages.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  const names = [...new Set(usages.map((u) => u.name))].sort((a, b) => a.localeCompare(b))
  return { version: 1, generatedAt: new Date().toISOString(), names, usages }
}
