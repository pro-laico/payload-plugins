import type { IconUsageManifest } from './usage-manifest'

export interface ScanOptions {
  roots?: string[]
  cwd?: string
  components?: string[]
  extensions?: string[]
  ignore?: string[]
}

export interface ScanResult {
  manifest: IconUsageManifest
  filesScanned: number
  rootsScanned: number
}
