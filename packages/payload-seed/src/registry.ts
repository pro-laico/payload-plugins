/**
 * The cross-file type bridge. The set of valid reference keys is materialized into types by
 * the plugin, which injects an augmentation of this interface into the project's
 * `payload-types.ts` during `payload generate:types` (via `typescript.postProcess`):
 *
 *   declare module '@pro-laico/payload-seed' {
 *     interface SeedRegistry {
 *       collections: { services: 'consulting' | 'implementation'; posts: 'launch' }
 *       globals: 'header' | 'footer'
 *       assets: 'hero' | 'serviceA' | 'post'
 *     }
 *   }
 *
 * Once augmented, `ref()` / `asset()` keys are checked against these unions — remove a
 * seeded item's `_key` and every reference to it becomes a TS error. Before types are
 * generated (interface empty), the resolvers below fall back to permissive `string` keys, so
 * refs are runtime-validated only. Progressive: safe without it, fully safe with it.
 */
// Intentionally empty — augmented in the project's payload-types.ts during generate:types.
export interface SeedRegistry {}

/** Resolve `SeedRegistry[K]` if augmented, else the permissive default `D`. */
type Resolve<K extends string, D> = K extends keyof SeedRegistry ? SeedRegistry[K] : D

/** Map of collection slug → union of that collection's declared `_key`s. */
export type RegistryCollections = Resolve<'collections', Record<string, string>>

/** Slugs that have at least one seeded doc (the keys of {@link RegistryCollections}). */
export type RegistryCollectionSlug = keyof RegistryCollections & string

/** Valid ref keys for a given collection slug. */
export type RegistryKey<C extends RegistryCollectionSlug> = RegistryCollections[C] & string

/** Union of declared global slugs. */
export type RegistryGlobal = Resolve<'globals', string>

/** Union of declared asset keys. */
export type RegistryAsset = Resolve<'assets', string>
