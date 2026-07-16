import type { CollectionSlug, GlobalSlug } from 'payload'

import type { SeedTokens } from '../tokens/seedTokens'
import type { SeedDisabledMarker } from '../plugin/collectionMarkers'
import type { CollectionSeedData, GlobalSeedData } from './seedData'

export type SeedBuilder<T> = (tokens: SeedTokens) => T

export interface GlobalSeedDefinition<TSlug extends GlobalSlug = GlobalSlug> {
  readonly kind: 'global'
  readonly slug: TSlug
  readonly build: SeedBuilder<GlobalSeedData<TSlug>>
  readonly disabled?: SeedDisabledMarker
}

export interface CollectionSeedDefinition<TSlug extends CollectionSlug = CollectionSlug> {
  readonly kind: 'collection'
  readonly slug: TSlug
  readonly build: SeedBuilder<Array<CollectionSeedData<TSlug>>>
  readonly disabled?: SeedDisabledMarker
}

export type SeedDefinition = CollectionSeedDefinition | GlobalSeedDefinition
