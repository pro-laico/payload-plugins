export interface WalkOptions {
  /** Populated-doc recursion depth (the consumer's `depth` arg already bounds population). @default 6 */
  maxDepth?: number
  /** Embed cap per walk — Next allows 128 tags per cache entry, and the static tags need
   *  room too. When hit, the walk stops and reports `capped`. @default 64 */
  maxTags?: number
}

/** One baked-in document: the dep tag the entry must carry, and where the content sits. */
export interface BakedEmbed {
  tag: string
  /** Dotted field path from the document root (block slugs included): `layout.hero.image`. */
  via: string
  kind: 'relationship' | 'upload' | 'join' | 'richText'
}

export interface WalkResult {
  /** The dep tags this entry must carry (one per baked-in doc, deduped). */
  tags: string[]
  /** Every bake-in with its provenance — the dev map's refactor-candidate list. */
  embeds: BakedEmbed[]
  /** True when `maxTags` cut the walk short — surface this in dev, it means stale-risk. */
  capped: boolean
}
