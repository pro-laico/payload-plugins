import { isAssetRef, isRef } from '../refs'
import { assetNodeId, collectTokens, docNodeId } from './tokens'

export interface BuiltRecord {
  key: string
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
  assetKeys: string[]
  collections: BuiltCollection[]
  globals: BuiltGlobal[]
}

export type GraphNodeType = 'asset' | 'doc' | 'global'
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
export interface SeedGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Doc node ids in dependency-first create order. */
  order: string[]
}

/** Build the dependency graph: asset/doc/global nodes, edges from each doc/global to the
 *  docs and assets it references, plus the topologically sorted doc create order. */
export function buildGraph(model: BuiltModel): SeedGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const docIds = new Set<string>()
  // dependency adjacency among doc nodes only (dependent → dependency)
  const docDeps = new Map<string, Set<string>>()

  for (const key of model.assetKeys) {
    nodes.push({ id: assetNodeId(key), type: 'asset', label: key, key })
  }

  for (const coll of model.collections) {
    for (const rec of coll.records) {
      const id = docNodeId(coll.slug, rec.key)
      docIds.add(id)
      docDeps.set(id, new Set())
      nodes.push({ id, type: 'doc', label: `${coll.slug}:${rec.key}`, collection: coll.slug, key: rec.key })
    }
  }

  const addEdgesFor = (fromId: string, data: unknown, trackDocDep: boolean) => {
    for (const token of collectTokens(data)) {
      const to = isRef(token) ? docNodeId(token.collection, token.key) : isAssetRef(token) ? assetNodeId(token.key) : null
      if (!to) continue
      edges.push({ from: fromId, to })
      if (trackDocDep && docIds.has(to)) docDeps.get(fromId)?.add(to)
    }
  }

  for (const coll of model.collections) {
    for (const rec of coll.records) addEdgesFor(docNodeId(coll.slug, rec.key), rec.data, true)
  }
  for (const g of model.globals) {
    const id = `global:${g.slug}`
    nodes.push({ id, type: 'global', label: g.slug, slug: g.slug })
    addEdgesFor(id, g.data, false)
  }

  return { nodes, edges, order: topoSortDocs(docIds, docDeps) }
}

/** Depth-first topological sort (dependencies first) with cycle detection. */
function topoSortDocs(docIds: Set<string>, deps: Map<string, Set<string>>): string[] {
  const order: string[] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (id: string) => {
    const s = state.get(id)
    if (s === 'done') return
    if (s === 'visiting') {
      const cycle = [...stack.slice(stack.indexOf(id)), id].join(' → ')
      throw new Error(`[payload-seed] dependency cycle detected: ${cycle}`)
    }
    state.set(id, 'visiting')
    stack.push(id)
    for (const dep of deps.get(id) ?? []) {
      if (!docIds.has(dep)) continue
      visit(dep)
    }
    stack.pop()
    state.set(id, 'done')
    order.push(id)
  }

  for (const id of docIds) visit(id)
  return order
}
