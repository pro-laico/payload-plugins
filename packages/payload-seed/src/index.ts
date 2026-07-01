// The plugin
export { seedPlugin } from './plugin'
export type { SeedPluginOptions } from './options'

// Authoring: define seed data (the `ref` / `file` tokens are supplied to each builder callback —
// `defineSeed('x', ({ ref, file }) => …)` — so they aren't imported). One helper for both:
// `defineSeed` infers collection (array of records) vs global (single object) from the slug.
export { defineSeed } from './defineSeed'

// The augmentable interface that generated types fill in (so `ref` keys are typed)
export type { SeedRegistry } from './registry'

// Authoring types for seed helpers COMPOSED across files (e.g. per-block seed fragments that a
// page definition assembles): `SeedTokens` types a helper's `{ ref, file }` parameter, `WithRefs`
// widens a generated data type so `Ref` tokens may sit in relationship fields, and `Ref` /
// `FileToken` are the token value types themselves.
export type { CollectionSeedData, GlobalSeedData, SeedTokens, WithRefs } from './types'
export type { FileToken, Ref } from './refs'
// The token constructors themselves, for code that builds seed data OUTSIDE a builder
// callback — e.g. unit tests exercising a composed seed fragment directly.
export { file, isFileToken, isRef, ref } from './refs'

// Run the seed from a script or test (the `payload seed` command and endpoint use this)
export { seed } from './engine/run'
