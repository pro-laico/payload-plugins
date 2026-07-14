import type { DependencyRule } from './dependencyRule'
import type { CollectionRevalidateConfig } from '../options/collectionConfig'

export interface RevalidatePluginOptions {
  enabled?: boolean
  prefix?: string
  collections?: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals?: Partial<Record<string, false>>
  rules?: DependencyRule[]
  observe?: boolean
  endpoint?: boolean
}

export interface ResolvedRevalidateOptions {
  enabled: boolean
  prefix: string
  collections: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals: Partial<Record<string, false>>
  rules: DependencyRule[]
  observe: boolean
  endpoint: boolean
}
