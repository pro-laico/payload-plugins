import type { AnyToken, FileToken, Ref, RegistryCollectionSlug, RegistryCollections, RegistryKey } from './types'

export type { AnyRef, AnyToken, FileToken, Ref } from './types'

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
 * Attach a source file to a seeded doc via its `_file` meta-key. The engine resolves the file
 * under the assets dir and — depending on the doc's collection — either uploads the bytes
 * (native upload collection) or hands the path to the collection's ingest hook (provider).
 *
 *   { _key: 'lighthouse', _file: file('lighthouse.png'), alt: 'A lighthouse' }   // native upload
 *   { _key: 'intro', _file: file('intro.mp4'), title: 'Intro' }                   // Mux provider
 *   { _key: 'inter', _file: file('inter.woff2', { weight: '400' }), family: 'sans' } // fonts provider
 */
export function file(name: string, options: Record<string, unknown> = {}): FileToken {
  return { __seedRef: 'file', name, options }
}

export function isRef(value: unknown): value is Ref {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'doc'
}

export function isFileToken(value: unknown): value is FileToken {
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'file'
}

/** Any seed token (doc reference or file). */
export function isAnyToken(value: unknown): value is AnyToken {
  return isRef(value) || isFileToken(value)
}
