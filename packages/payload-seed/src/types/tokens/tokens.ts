import type { RegistryCollectionSlug, RegistryKey } from '../registry/registry'

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
