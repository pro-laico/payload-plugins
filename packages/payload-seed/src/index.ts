// Plugin
export { seedPlugin } from './plugin'
export type { AssetOptions, GraphOptions, ResolvedSeedOptions, SeedAuthorize, SeedPluginOptions } from './options'

// Authoring helpers
export { defineSeed, defineGlobalSeed, defineBlockSeed, defineAssets } from './defineSeed'
export { ref, asset, isRef, isAssetRef, isAnyRef } from './refs'
export type { AnyRef, AssetRef, Ref } from './refs'

// Types
export type {
  AssetSpec,
  AssetsSeedDefinition,
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
export { runSeed, seed } from './engine/run'
export type { RunSeedArgs, SeedResult } from './engine/run'

// Codegen — type-safe ref registry + definitions barrel
export { generateSeedTypes } from './generate'
export type { GenerateOptions, GenerateResult } from './generate'
export { createSeedEndpoint } from './endpoint'
export { seedingEnabled, SEED_DISABLED_MESSAGE } from './guard'
