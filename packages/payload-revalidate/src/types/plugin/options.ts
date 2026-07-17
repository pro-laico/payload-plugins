import type { DependencyRule } from './dependencyRule'
import type { CollectionRevalidateConfig } from './collectionConfig'

export interface RevalidatePluginOptions {
  /** Register no hooks or endpoints when false. Default `true`. */
  enabled?: boolean
  /** Namespaces every emitted tag (`'app:'` → `app:posts:my-slug`). Default `''`. */
  prefix?: string
  /** Per-collection config, keyed by slug; `false` opts one out.
   *
   * - `idField`
   * - `lists`
   * - `extraTags` */
  collections?: Partial<Record<string, CollectionRevalidateConfig | false>>
  /** Opt a global out by setting its slug to `false`. All are tracked by default. */
  globals?: Partial<Record<string, false>>
  /** Manual busts for data the field-walk can't see.
   *
   * - `on`
   * - `bust`
   * - `whenFields` */
  rules?: DependencyRule[]
  /** Force the dependency map + dev warnings on in production. Default: dev only. Off means the
   * `/api/revalidate-map` endpoints aren't registered at all. */
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
