// Plugin
export { seedPlugin } from './plugin'
export type { AssetOptions, GraphOptions, ResolvedSeedOptions, SeedAuthorize, SeedButtonSlot, SeedPluginOptions } from './options'

// Authoring helpers
export { defineSeed, defineGlobalSeed, defineAssets } from './defineSeed'
export { ref, asset, isRef, isAssetRef, isAnyRef } from './refs'
export type { AnyRef, AssetRef, Ref } from './refs'

// Types
export type {
  AssetSpec,
  AssetsSeedDefinition,
  CollectionSeedData,
  CollectionSeedDefinition,
  GlobalSeedData,
  GlobalSeedDefinition,
  SeedBuilder,
  SeedDefinition,
  SeedTokens,
  WithRefs,
} from './types'
export type { SeedRegistry } from './registry'

// Engine + run infra (for CLI runners and custom integrations)
export { runSeed, seed } from './engine/run'
export type { RunSeedArgs, SeedResult } from './engine/run'

// Type generation — the SeedRegistry augmentation injected into payload-types.ts
export { buildSeedRegistry, SEED_PACKAGE } from './typegen'
export { createSeedEndpoint } from './endpoint'
export { seedingEnabled, SEED_DISABLED_MESSAGE } from './guard'
