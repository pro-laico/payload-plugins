import type { CollectionSlug } from 'payload'
import type { SeedDefinition } from '../definitions/definitions'

export interface SeedPluginOptions {
  definitions?: SeedDefinition[]
  assetsDir?: string
  assetSubDirs?: Partial<Record<CollectionSlug, string>>
  adminButton?: boolean
}

export interface ResolvedSeedOptions {
  definitions?: SeedDefinition[]
  assetsDir: string
  assetSubDirs: Partial<Record<string, string>>
  adminButton: boolean
}
