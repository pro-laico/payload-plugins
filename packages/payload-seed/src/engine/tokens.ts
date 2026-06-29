import { type AnyRef, type AssetRef, isAnyRef, isAssetRef, isRef, isSourceRef, type Ref, type SourceRef } from '../refs'
import { sourceKey } from './sources'

/** The map key for a seeded doc node: `collection:_key`. */
export const docNodeId = (collection: string, key: string): string => `${collection}:${key}`

/** The map key for an asset node: `asset:key`. */
export const assetNodeId = (key: string): string => `asset:${key}`

/** Walk a seed-data value and collect every ref/asset token it contains. */
export function collectTokens(value: unknown, out: AnyRef[] = []): AnyRef[] {
  if (isAnyRef(value)) {
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

export interface ResolveContext {
  /** `collection:_key` → created doc id. */
  docs: Map<string, string | number>
  /** asset key → created upload id. */
  assets: Map<string, string | number>
  /** `token\0file` → absolute source path (for provider source tokens). */
  sources: Map<string, string>
  /** For error messages. */
  where: string
}

/** Deep-clone a seed-data value, replacing every ref/asset/source token with its resolved
 *  value. Throws a contextual error if a token can't be resolved (should be impossible after
 *  validation + topo-sort, but guards against engine bugs). */
export function resolveTokens(value: unknown, ctx: ResolveContext): unknown {
  if (isRef(value)) return resolveRef(value, ctx)
  if (isAssetRef(value)) return resolveAsset(value, ctx)
  if (isSourceRef(value)) return resolveSource(value, ctx)
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

function resolveAsset(token: AssetRef, ctx: ResolveContext): string | number {
  const id = ctx.assets.get(token.key)
  if (id === undefined) {
    throw new Error(`[payload-seed] ${ctx.where}: unresolved asset('${token.key}') - no asset declared with that key.`)
  }
  return id
}

/** Resolve a source token to the value the provider collection ingests: the absolute file
 *  path (resolved in the pre-pass) plus the token's options. The owning collection's hook
 *  turns this into the stored asset. */
function resolveSource(token: SourceRef, ctx: ResolveContext): Record<string, unknown> {
  const file = ctx.sources.get(sourceKey(token.token, token.file))
  if (file === undefined) {
    throw new Error(
      `[payload-seed] ${ctx.where}: unresolved ${token.token}('${token.file}') - source file not found or no provider registered.`,
    )
  }
  return { file, ...token.options }
}
