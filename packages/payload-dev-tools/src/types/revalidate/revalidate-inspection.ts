export type RevalidateInspection = {
  graph: { collections: string[]; globals: string[]; edges: { from: string; to: string; via: string; kind: string; polymorphic?: boolean }[] }
  prefix: string
  observing: boolean
  rules: { on: string; bust: string[]; whenFields?: string[] }[]
  settings: Record<string, { idField: string | false; lists: Record<string, string[]>; extraTags: string[]; fields: string[] }>
  getters: {
    helper: 'cacheDoc' | 'cacheIds' | 'cacheGlobal'
    slug: string
    list?: string
    label?: string
    getter?: string
    file: string
    line: number
  }[]
  reads: {
    kind: string
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
    lastAt: string
    count: number
  }[]
  events: {
    at: string
    source: string
    trigger: { slug: string; id?: string | number; operation: string; lane: string }
    busted: { tag: string; reason: string }[]
  }[]
}

export type Read = RevalidateInspection['reads'][number]
