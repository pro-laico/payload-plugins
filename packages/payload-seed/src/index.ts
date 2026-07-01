// The plugin
export { seedPlugin } from './plugin'

// Authoring: define seed data (the `ref` / `file` tokens are supplied to each builder callback —
// `defineSeed('x', ({ ref, file }) => …)` — so they aren't imported). One helper for both:
// `defineSeed` infers collection (array of records) vs global (single object) from the slug.
export { defineSeed } from './defineSeed'

// The augmentable interface that generated types fill in (so `ref` keys are typed)
export type { SeedRegistry } from './registry'

// Run the seed from a script or test (the `payload seed` command and endpoint use this)
export { seed } from './engine/run'
