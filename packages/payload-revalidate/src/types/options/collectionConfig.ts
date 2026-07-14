export interface CollectionRevalidateConfig {
  idField?: string | false
  lists?: Record<string, { fields: string[] }>
  extraTags?: string[]
}

export type RevalidateMarker = false | CollectionRevalidateConfig

export interface CollectionSettings {
  idField: string | false
  lists: Record<string, string[]>
  extraTags: string[]
}
