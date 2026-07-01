// The plugin
export { seedPlugin } from './plugin'

// Authoring: define seed data (the `ref` / `file` tokens are supplied to each builder callback —
// `defineCollectionSeed('x', ({ ref, file }) => …)` — so they aren't imported)
export { defineCollectionSeed, defineGlobalSeed } from './defineCollectionSeed'

// The augmentable interface that generated types fill in (so `ref` keys are typed)
export type { SeedRegistry } from './registry'

// Run the seed from a script or test (the `payload seed` command and endpoint use this)
export { seed } from './engine/run'
