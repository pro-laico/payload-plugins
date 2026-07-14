export interface ScannedCall {
  helper: 'cacheDoc' | 'cacheIds' | 'cacheGlobal'
  slug: string
  list?: string
  label?: string
  getter?: string
  line: number
}

export interface ScannedGetter extends ScannedCall {
  file: string
}

export interface LiveScanOptions {
  roots?: string[]
  cwd?: string
}
