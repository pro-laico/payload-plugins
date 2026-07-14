export type GraphNodeType = 'doc' | 'global'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  collection?: string
  slug?: string
  key?: string
}

export interface GraphEdge {
  from: string
  to: string
}

export interface DeferredField {
  node: string
  field: string
}

export interface SeedGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  order: string[]
  deferred: DeferredField[]
}

export type RequiredLookup = (collection: string, field: string) => boolean
