import type { RegistryAsset, RegistryCollectionSlug, RegistryCollections, RegistryKey } from './registry'

/**
 * A typed reference to another seeded document, used in place of a raw id inside seed
 * data. The engine resolves it to the created doc's id at create time and records a
 * dependency edge (dependent → dependency) for the topological sort and graph. A ref
 * is the ONLY way to point at another doc — you can't fabricate an id — which is what
 * makes the dependency graph complete and tamper-resistant.
 */
export interface Ref<C extends RegistryCollectionSlug = RegistryCollectionSlug> {
  readonly __seedRef: 'doc'
  readonly collection: C
  readonly key: RegistryKey<C>
}

/** A typed reference to an uploaded asset (see the media registry). Resolved to the
 *  created upload doc's id at create time. */
export interface AssetRef {
  readonly __seedRef: 'asset'
  readonly key: RegistryAsset
}

export type AnyRef = Ref | AssetRef

/**
 * Reference a seeded document by collection slug and local `_key`. Type-checked against
 * the generated {@link SeedRegistry} — once codegen has run, an unknown or removed key
 * is a TS error at every use site.
 *
 *   relatedService: ref('services', 'consulting')
 */
export function ref<C extends RegistryCollectionSlug>(collection: C, key: RegistryCollections[C] & string): Ref<C> {
  return { __seedRef: 'doc', collection, key: key as RegistryKey<C> }
}

/**
 * Reference an uploaded asset by its registry key. The engine uploads all referenced
 * assets first, then resolves this to the upload doc's id.
 *
 *   image: asset('serviceA')
 */
export function asset(key: RegistryAsset): AssetRef {
  return { __seedRef: 'asset', key }
}

export function isRef(value: unknown): value is Ref {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'doc'
}

export function isAssetRef(value: unknown): value is AssetRef {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'asset'
}

export function isAnyRef(value: unknown): value is AnyRef {
  return isRef(value) || isAssetRef(value)
}
