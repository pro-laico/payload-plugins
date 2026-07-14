import type { FileToken } from '../tokens/tokens'

export interface BuiltRecord {
  key: string
  file?: FileToken
  data: Record<string, unknown>
}

export interface BuiltCollection {
  slug: string
  records: BuiltRecord[]
}

export interface BuiltGlobal {
  slug: string
  data: Record<string, unknown>
}

export interface BuiltModel {
  collections: BuiltCollection[]
  globals: BuiltGlobal[]
}
