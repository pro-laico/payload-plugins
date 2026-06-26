// Plugin
export { seedPlugin } from './plugin'
export type { AssetOptions, GraphOptions, ResolvedSeedOptions, SeedAuthorize, SeedPluginOptions } from './options'

// Authoring helpers
export { defineSeed, defineGlobalSeed, defineBlockSeed } from './defineSeed'
export { ref, asset, isRef, isAssetRef, isAnyRef } from './refs'
export type { AnyRef, AssetRef, Ref } from './refs'

// Types
export type {
  BlockSeedDefinition,
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
export { runSeed } from './engine/run'
export type { RunSeedArgs, SeedResult } from './engine/run'
export { createSeedEndpoint } from './endpoint'
export { seedingEnabled, SEED_DISABLED_MESSAGE } from './guard'
