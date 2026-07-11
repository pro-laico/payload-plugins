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

/** A doc field whose refs were deferred to break a dependency cycle: created null, then set in a
 *  second pass once every doc exists. `node` is the owning doc (`collection:_key`); `field` its top-level field. */
export interface DeferredField {
  node: string
  field: string
}

export interface SeedGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Doc node ids in dependency-first create order. */
  order: string[]
  /** Fields deferred to break cycles (empty when the graph is acyclic). */
  deferred: DeferredField[]
}

/** Whether a top-level field is required (so its refs can't be deferred). Defaults to treating every
 *  field as required — i.e. no field is deferrable, so any cycle is a hard error (the strict default).
 *  The engine passes a real lookup (from the live config) to enable optional-field cycle breaking. */
export type RequiredLookup = (collection: string, field: string) => boolean
