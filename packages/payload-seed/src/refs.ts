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

/** Options carried by a {@link SourceRef} — forwarded to the provider collection's ingest. */
export interface SourceOptions {
  playbackPolicy?: 'public' | 'signed'
  posterTimestamp?: number
}

/**
 * A source-file token for an asset-provider collection (e.g. a Mux video). Unlike {@link Ref}
 * / {@link AssetRef} it does NOT point at another node — it carries a local source file the
 * owning collection ingests. The engine resolves it to `{ file: <abs path>, ...options }`,
 * which the collection's hook turns into the stored asset. Created via the provider's builder
 * token (e.g. `video('intro.mp4')`).
 */
export interface SourceRef {
  readonly __seedRef: 'source'
  /** Provider/builder token name (e.g. `'video'`). */
  readonly token: string
  /** Source filename, relative to the provider's source dir under the assets dir. */
  readonly file: string
  readonly options: SourceOptions
}

/** A reference to another seeded node (doc or asset). Drives the dependency graph. */
export type AnyRef = Ref | AssetRef

/** Any seed token that may appear in record data — node references plus source files. */
export type AnyToken = AnyRef | SourceRef

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

/**
 * Reference a local source video for an asset-provider collection (Mux). The engine resolves
 * the file under the provider's source dir and hands it to the collection, which uploads it.
 *
 *   source: video('intro.mp4', { playbackPolicy: 'public' })
 */
export function video(file: string, options: SourceOptions = {}): SourceRef {
  return { __seedRef: 'source', token: 'video', file, options }
}

export function isRef(value: unknown): value is Ref {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'doc'
}

export function isAssetRef(value: unknown): value is AssetRef {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'asset'
}

export function isSourceRef(value: unknown): value is SourceRef {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'source'
}

export function isAnyRef(value: unknown): value is AnyRef {
  return isRef(value) || isAssetRef(value)
}

/** Any seed token (node reference or source file). */
export function isAnyToken(value: unknown): value is AnyToken {
  return isRef(value) || isAssetRef(value) || isSourceRef(value)
}
