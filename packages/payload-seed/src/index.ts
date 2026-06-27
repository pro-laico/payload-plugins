// The plugin
export { seedPlugin } from './plugin'
export type { SeedPluginOptions } from './options'

// Authoring: define seed data, reference docs/assets with typed tokens
export { defineSeed, defineGlobalSeed, defineAssets } from './defineSeed'
export { ref, asset } from './refs'
export type { SeedDefinition } from './types'

// The augmentable interface that generated types fill in (so `ref`/`asset` keys are typed)
export type { SeedRegistry } from './registry'

// Run the seed from a script or test (the `payload seed` command and endpoint use this)
export { seed } from './engine/run'
export type { SeedResult } from './engine/run'
