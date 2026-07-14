export interface IconUsage {
  name: string
  file: string
  line: number
  column: number
}

export interface IconUsageManifest {
  version: 1
  generatedAt: string
  names: string[]
  usages: IconUsage[]
}
