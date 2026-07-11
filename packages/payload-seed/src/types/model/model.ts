import type { FileToken } from '../tokens/tokens'

export interface BuiltRecord {
  key: string
  /** The record's `_file` meta-key, if it attaches a source file. */
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
