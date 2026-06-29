// The plugin
export { seedPlugin } from './plugin'
export type { SeedPluginOptions } from './options'

// Authoring: define seed data (the `ref` / `asset` / `video` tokens are supplied to each
// builder callback — `defineSeed('x', ({ ref, asset, video }) => …)` — so they aren't imported)
export { defineSeed, defineGlobalSeed, defineAssets } from './defineSeed'
export type { SeedAssetProvider, SeedDefinition } from './types'

// The augmentable interface that generated types fill in (so `ref`/`asset` keys are typed)
export type { SeedRegistry } from './registry'

// Run the seed from a script or test (the `payload seed` command and endpoint use this)
export { seed } from './engine/run'
export type { SeedResult } from './engine/run'
