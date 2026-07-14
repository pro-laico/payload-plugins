import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import { isRecord } from '../lib/isRecord'
import type { IconUsageManifest } from '../types'

const isIconUsageManifest = (value: unknown): value is IconUsageManifest =>
  isRecord(value) && Array.isArray(value.names) && Array.isArray(value.usages)

export const DEFAULT_MANIFEST_FILENAME = 'icon-usage-manifest.json'

export const MANIFEST_PATH_ENV = 'ICON_USAGE_MANIFEST'

export const resolveManifestPath = (explicit?: string, cwd: string = process.cwd()): string => {
  const chosen = explicit ?? process.env[MANIFEST_PATH_ENV] ?? DEFAULT_MANIFEST_FILENAME
  return isAbsolute(chosen) ? chosen : resolve(cwd, chosen)
}

export const loadIconUsageManifest = (path?: string, cwd?: string): IconUsageManifest | null => {
  const abs = resolveManifestPath(path, cwd)
  try {
    const parsed: unknown = JSON.parse(readFileSync(abs, 'utf8'))
    return isIconUsageManifest(parsed) ? parsed : null
  } catch {
    return null
  }
}
