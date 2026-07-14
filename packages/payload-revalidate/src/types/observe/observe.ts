export interface ObservedRead {
  kind: 'doc' | 'ids' | 'global'
  collection?: string
  global?: string
  as?: string | number
  list?: string
  undeclared?: boolean
  draft: boolean
  label?: string
  staticTags: string[]
  depTags: string[]
  bakedIn: { tag: string; via: string; kind: string }[]
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
