import type { DependencyRule } from './dependencyRule'
import type { CollectionRevalidateConfig } from './collectionConfig'

export interface RevalidatePluginOptions {
  enabled?: boolean
  prefix?: string
  collections?: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals?: Partial<Record<string, false>>
  rules?: DependencyRule[]
  /** Records what each cached getter read, powering `/api/revalidate-map` and the CLI. Dev-only by
   * default; when off the map endpoints are not registered at all. */
  observe?: boolean
}

export interface ResolvedRevalidateOptions {
  enabled: boolean
  prefix: string
  collections: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals: Partial<Record<string, false>>
  rules: DependencyRule[]
  observe: boolean
}
