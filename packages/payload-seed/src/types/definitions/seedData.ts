import type { CollectionSlug, DataFromGlobalSlug, GlobalSlug, RequiredDataFromCollectionSlug } from 'payload'

import type { FileToken, Ref } from '../tokens/tokens'

export type WithRefs<T> = T extends Ref
  ? T
  : T extends Date
    ? T
    : T extends (infer U)[]
      ? Array<WithRefs<U> | Ref>
      : T extends object
        ? { [K in keyof T]: WithRefs<T[K]> | Ref }
        : T

export type CollectionSeedData<TSlug extends CollectionSlug> = WithRefs<RequiredDataFromCollectionSlug<TSlug>> & {
  _key: string
  _file?: FileToken
}

export type GlobalSeedData<TSlug extends GlobalSlug> = WithRefs<
  Omit<DataFromGlobalSlug<TSlug>, 'id' | 'globalType' | 'createdAt' | 'updatedAt'>
>
