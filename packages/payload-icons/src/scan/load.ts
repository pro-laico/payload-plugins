import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import type { IconUsageManifest } from '../types'

export const DEFAULT_MANIFEST_FILENAME = 'icon-usage-manifest.json'

export const MANIFEST_PATH_ENV = 'ICON_USAGE_MANIFEST'

export const resolveManifestPath = (explicit?: string, cwd: string = process.cwd()): string => {
  const chosen = explicit ?? process.env[MANIFEST_PATH_ENV] ?? DEFAULT_MANIFEST_FILENAME
  return isAbsolute(chosen) ? chosen : resolve(cwd, chosen)
}

export const loadIconUsageManifest = (path?: string, cwd?: string): IconUsageManifest | null => {
  const abs = resolveManifestPath(path, cwd)
  try {
    const parsed = JSON.parse(readFileSync(abs, 'utf8')) as IconUsageManifest //TODO: replace `as` cast with proper typing
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.names)) return null
    return parsed
  } catch {
    return null
  }
}
