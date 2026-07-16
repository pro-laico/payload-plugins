import type { CollectionSlug } from 'payload'
import type { SeedDefinition } from '../definitions/definitions'

export interface SeedPluginOptions {
  enabled?: boolean
  definitions?: SeedDefinition[]
  assetsDir?: string
  assetSubDirs?: Partial<Record<CollectionSlug, string>>
}

export interface ResolvedSeedOptions {
  enabled: boolean
  definitions?: SeedDefinition[]
  assetsDir: string
  assetSubDirs: Partial<Record<string, string>>
}
