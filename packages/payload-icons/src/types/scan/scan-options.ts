import type { IconUsageManifest } from './usage-manifest'

export interface ScanOptions {
  /**
   * Directories (or individual files) to scan, relative to {@link cwd} or
   * absolute. Each directory is walked recursively.
   *
   * @default ['src', 'app']
   */
  roots?: string[]
  /**
   * Working directory the scan resolves {@link roots} and reports file paths
   * relative to.
   *
   * @default process.cwd()
   */
  cwd?: string
  /**
   * JSX tag names treated as icon usages. Forwarded to {@link extractIconUsages}.
   *
   * @default ['Icon']
   */
  components?: string[]
  /**
   * File extensions (without the dot) to read.
   *
   * @default ['tsx', 'jsx', 'ts', 'js', 'mdx']
   */
  extensions?: string[]
  /**
   * Directory names to skip while walking.
   *
   * @default ['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo']
   */
  ignore?: string[]
}

/** The result of a {@link scanIconUsages} run. */
export interface ScanResult {
  /** The assembled manifest, ready to write. */
  manifest: IconUsageManifest
  /** Number of files read during the scan. */
  filesScanned: number
  /** Number of scan roots that actually existed — `0` means every root was missing (wrong cwd?). */
  rootsScanned: number
}
