import type { RegistryCollectionSlug, RegistryCollections, RegistryKey } from './registry'

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

/**
 * A file attached to a seeded upload/provider doc via its `_file` meta-key. Carries a source
 * filename (resolved under the assets dir at seed time) plus optional provider-specific options.
 * How the file is delivered depends on the doc's collection:
 *  - an **upload collection** → the bytes are read and passed as the created doc's upload.
 *  - a registered **provider collection** (e.g. Mux, fonts) → the resolved path + options are
 *    handed to the collection's ingest hook via its source field.
 */
export interface FileToken {
  readonly __seedRef: 'file'
  /** Source filename, resolved under the assets dir (native: searched subdirs; provider: its subdir). */
  readonly name: string
  /** Provider-specific ingest options (e.g. a font `weight`), merged into the provider source field.
   *  Ignored for native uploads. */
  readonly options: Record<string, unknown>
}

/** Any edge-creating reference (drives the dependency graph). Only doc refs create edges. */
export type AnyRef = Ref

/** Any seed token that may appear in record data. */
export type AnyToken = Ref | FileToken

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
