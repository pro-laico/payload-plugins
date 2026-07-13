import type { Block, CollectionConfig, Field, GlobalConfig } from 'payload'

/**
 * One "can embed" relationship in the schema: an entry rendered from `from` may carry
 * `to`'s data at the field path `via`, so a write to `to` can make `from` surfaces stale.
 * `to: '*'` marks a richText field — what it embeds is per-document (any upload /
 * relationship its editor allows), discovered at runtime by the walk, not statically.
 */
export interface ReferenceEdge {
  from: string
  to: string
  /** Dotted field path from the document root, block slugs included: `layout.hero.image`. */
  via: string
  kind: 'relationship' | 'upload' | 'join' | 'richText'
  polymorphic?: boolean
  /** For `join` edges: the field on `to` (the child) whose value names the parent — the
   *  membership key the dev map keys `{to}:join:{on}:{parentId}` on. */
  on?: string
}

/** The static dependency map: what CAN revalidate what, derived purely from the config. */
export interface ReferenceGraph {
  collections: string[]
  globals: string[]
  edges: ReferenceEdge[]
}

export type GraphSource = {
  collections?: CollectionConfig[] | { slug: string; fields: Field[] }[]
  globals?: GlobalConfig[] | { slug: string; fields: Field[] }[]
  blocks?: Block[]
}
