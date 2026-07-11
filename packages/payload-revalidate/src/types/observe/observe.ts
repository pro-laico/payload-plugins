export interface ObservedRead {
  kind: 'doc' | 'ids' | 'global'
  collection?: string
  global?: string
  /** The identifier the read was keyed by (id or alias), when doc-scoped. */
  as?: string | number
  /** The list scope an `ids` read carries (undefined = the bare collection list tag). */
  list?: string
  /** The scope is carried but not declared in `options.collections[slug].lists` — the
   *  hooks can't bust it on reorders. The dev map flags this loudly. */
  undeclared?: boolean
  draft: boolean
  /** Optional human name for the read (the `label` option on the cache helpers). */
  label?: string
  staticTags: string[]
  depTags: string[]
  /** Populated content baked into this entry — atomic-refactor candidates, with the
   *  field path each came through. */
  bakedIn: { tag: string; via: string; kind: string }[]
  /** True when the walk hit `maxTags` — this entry may under-tag (stale risk). */
  capped: boolean
  firstAt: string
  lastAt: string
  count: number
}

export interface RevalidateEvent {
  at: string
  source: 'hook' | 'seed' | 'manual'
  trigger: {
    slug: string
    id?: string | number
    operation: 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'seed' | 'manual'
    lane: 'published' | 'draft'
  }
  busted: { tag: string; reason: 'doc' | 'alias' | 'list' | 'join' | 'extra' | 'rule' | 'global' | 'all' | 'manual' }[]
}

export interface Registry {
  reads: Map<string, ObservedRead>
  events: RevalidateEvent[]
}
