import { type AnyRef, isAnyToken, isRef, type Ref } from '../refs'
import type { ResolveContext } from '../types'

/** The map key for a seeded doc node: `collection:_key`. */
export const docNodeId = (collection: string, key: string): string => `${collection}:${key}`

/** Walk a seed-data value and collect every ref token it contains (drives the dependency graph). */
export function collectTokens(value: unknown, out: AnyRef[] = []): AnyRef[] {
  if (isRef(value)) {
    out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTokens(item, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectTokens(v, out)
  }
  return out
}

/** Deep-clone a seed-data value, replacing every ref token with its resolved id. Throws a
 *  contextual error if a ref can't be resolved (should be impossible after validation +
 *  topo-sort, but guards against engine bugs). */
export function resolveTokens(value: unknown, ctx: ResolveContext): unknown {
  if (isRef(value)) return resolveRef(value, ctx)
  if (isAnyToken(value)) return value // any non-ref token passes through untouched
  if (Array.isArray(value)) return value.map((item) => resolveTokens(item, ctx))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveTokens(v, ctx)
    return out
  }
  return value
}

function resolveRef(token: Ref, ctx: ResolveContext): string | number {
  const id = ctx.docs.get(docNodeId(token.collection, token.key))
  if (id === undefined) {
    throw new Error(`[payload-seed] ${ctx.where}: unresolved ref('${token.collection}', '${token.key}') - no seeded doc with that _key.`)
  }
  return id
}
