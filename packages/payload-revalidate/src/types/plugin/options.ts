import type { DependencyRule } from './dependencyRule'
import type { CollectionRevalidateConfig } from './collectionConfig'

export interface RevalidatePluginOptions {
  /** Register no hooks or endpoints when false. Default `true`. */
  enabled?: boolean
  /** Tracking config for YOUR collections, keyed by slug; `false` opts one out. This plugin registers
   * no collections of its own — it annotates the ones you already have, so there's no `slug` /
   * `overrides` here, just the per-collection settings.
   *
   * - `idField`
   * - `lists`
   * - `extraTags` */
  collections?: Partial<Record<string, CollectionRevalidateConfig | false>>
  /** Opt one of YOUR globals out by setting its slug to `false`. All are tracked by default. */
  globals?: Partial<Record<string, false>>
  /** This plugin's own knobs.
   *
   * - `prefix`
   * - `rules`
   * - `observe` */
  options?: RevalidateOptions
}

export interface RevalidateOptions {
  /** Namespaces every emitted tag (`'app:'` → `app:posts:my-slug`). Default `''`. */
  prefix?: string
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

/** `RevalidatePluginOptions` with the defaults applied — same keys, same nesting. */
export interface ResolvedRevalidateOptions {
  enabled: boolean
  collections: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals: Partial<Record<string, false>>
  options: { prefix: string; rules: DependencyRule[]; observe: boolean }
}
