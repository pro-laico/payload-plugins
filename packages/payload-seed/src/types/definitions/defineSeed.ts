import type { CollectionSlug, GlobalSlug } from 'payload'
import type { CollectionSeedData, GlobalSeedData } from './seedData'
import type { CollectionSeedDefinition, GlobalSeedDefinition } from './definitions'

// Re-enable excess-property checking, which TS disables for our mapped/intersection record
// types: any key on `T` not present in `Shape` is forced to `never`, so a misspelled or
// bogus field fails to type-check. (Wrong-*typed* values are already caught by the `extends`
// constraint; this adds the missing unknown-*field* check.)
export type Exact<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>
export type ExactEach<T extends readonly unknown[], Shape> = { [I in keyof T]: Exact<T[I], Shape> }

// The seed shape for a slug: an array of records for a collection, a single data object for a
// global. Keyed on the slug, which is already pinned from the first argument by the time `build`
// is checked, so the conditional collapses to one concrete branch.
export type ShapeFor<TSlug> = TSlug extends CollectionSlug
  ? ReadonlyArray<CollectionSeedData<TSlug>>
  : TSlug extends GlobalSlug
    ? GlobalSeedData<TSlug>
    : never

// Apply the excess-field check to whichever branch `ShapeFor` resolved to (per-record for a
// collection array, whole-object for a global).
export type ExactFor<T, Shape> = Shape extends readonly unknown[]
  ? T extends readonly unknown[]
    ? ExactEach<T, Shape[number]>
    : never
  : Exact<T, Shape>

// The definition a given slug produces, so the return type discriminates like the data does.
export type DefinitionFor<TSlug> = TSlug extends CollectionSlug
  ? CollectionSeedDefinition<TSlug>
  : TSlug extends GlobalSlug
    ? GlobalSeedDefinition<TSlug>
    : never
