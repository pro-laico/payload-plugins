import type { Payload } from 'payload'

import type { Tags } from './tagOptions'
import type { WalkOptions } from './walk'
import type { CacheFinders } from './finders'

interface BaseOptions {
  draft?: boolean
  tags?: string[]
  label?: string
}

export interface CacheDocOptions extends BaseOptions {
  as?: string | number
  walk?: false | WalkOptions
}

export interface CacheIdsOptions extends BaseOptions {
  list?: string
}

export interface FinishInput {
  payload: Payload
  tags: Tags
  observe: boolean
  kind: 'doc' | 'global'
  collection?: string
  global?: string
  as?: string | number
  staticTags: string[]
  value: unknown
  slug: string
  options: CacheDocOptions
}

export interface CacheHelpers extends CacheFinders {
  cacheDoc: <T>(doc: T, collection: string, options?: CacheDocOptions) => Promise<T>
  cacheIds: <T>(result: T, collection: string, options?: CacheIdsOptions) => Promise<T>
  cacheGlobal: <T>(doc: T, slug: string, options?: CacheDocOptions) => Promise<T>
  revalidateDoc: (slug: string, id: string | number) => Promise<void>
  revalidateList: (slug: string) => Promise<void>
  revalidateGlobal: (slug: string) => Promise<void>
  revalidateAll: () => Promise<void>
}
