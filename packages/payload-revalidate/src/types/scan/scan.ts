export interface ScannedCall {
  helper: 'cacheDoc' | 'cacheIds' | 'cacheGlobal'
  /** The collection (or global) slug — the helper's second argument, when literal. */
  slug: string
  /** `list: '<scope>'` when present (cacheIds). */
  list?: string
  /** `label: '<name>'` when present. */
  label?: string
  /** The nearest enclosing function/const declaration above the call — the getter's name. */
  getter?: string
  /** 1-indexed line of the call. */
  line: number
}

export interface ScannedGetter extends ScannedCall {
  /** Repo-relative posix path of the file the call sits in. */
  file: string
}

export interface LiveScanOptions {
  /** Directories/files to scan, relative to {@link cwd} or absolute. @default ['src', 'app'] */
  roots?: string[]
  /** Working directory. @default process.cwd() */
  cwd?: string
}
