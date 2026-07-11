import type { CollectionSlug, GlobalSlug } from 'payload'
import type { CollectionSeedData, GlobalSeedData } from './seedData'
import type { SeedDisabledMarker } from '../options/markers'
import type { SeedTokens } from '../tokens/seedTokens'

/** A seed builder receives the ref/file tokens and returns the seed data. Deferred
 *  (not eager data) so refs resolve against the full definition set. */
export type SeedBuilder<T> = (tokens: SeedTokens) => T

export interface CollectionSeedDefinition<TSlug extends CollectionSlug = CollectionSlug> {
  readonly kind: 'collection'
  readonly slug: TSlug
  readonly build: SeedBuilder<Array<CollectionSeedData<TSlug>>>
  /** Skip this definition at seed time (a string is used as the warning's reason). The definition
   *  still contributes to the generated seed-ref types, so gating it doesn't shift types. Also set
   *  automatically when the target collection declares `custom.seedDisabled`. */
  readonly disabled?: SeedDisabledMarker
}

export interface GlobalSeedDefinition<TSlug extends GlobalSlug = GlobalSlug> {
  readonly kind: 'global'
  readonly slug: TSlug
  readonly build: SeedBuilder<GlobalSeedData<TSlug>>
  /** Skip this definition at seed time (a string is used as the warning's reason). */
  readonly disabled?: SeedDisabledMarker
}

export type SeedDefinition = CollectionSeedDefinition | GlobalSeedDefinition
