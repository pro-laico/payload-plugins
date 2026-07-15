export interface CollectionRevalidateConfig {
  idField?: string | false
  /** Declared list scopes: `{ scope: [determinant fields] }`. The `{ fields }` object form is the future-extension slot. */
  lists?: Record<string, string[] | { fields: string[] }>
  extraTags?: string[]
}

export type RevalidateMarker = false | CollectionRevalidateConfig

export interface CollectionSettings {
  idField: string | false
  lists: Record<string, string[]>
  extraTags: string[]
}
