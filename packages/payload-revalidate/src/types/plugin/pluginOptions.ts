import type { CollectionRevalidateConfig } from '../options/collectionConfig'
import type { DependencyRule } from './dependencyRule'

/**
 * Options for {@link revalidatePlugin}. Zero-config by design: `revalidatePlugin()`
 * attaches surgical revalidation hooks to every collection and global, and the `./cache`
 * helpers pick everything up from the config. Reach for options only to opt slugs out,
 * tune list-tag sensitivity, or add manual dependency rules.
 *
 * @example
 * ```ts
 * revalidatePlugin({
 *   collections: { searchIndex: false, posts: { listFields: ['featured'] } },
 *   rules: [{ on: 'faqs', bust: ['services'], whenFields: ['question', 'answer'] }],
 * })
 * ```
 */
export interface RevalidatePluginOptions {
  /** When `false`, the plugin is a no-op — no hooks, no endpoint. @default true */
  enabled?: boolean
  /** Namespace prefixed onto every tag (`shop` → `shop:posts:42`). Use when multiple
   *  Payload apps share one Next cache surface. @default '' */
  prefix?: string
  /** Per-collection settings or `false` to opt a collection out. Wins over the
   *  collection's own `custom.revalidate` marker, field by field. */
  collections?: Partial<Record<string, CollectionRevalidateConfig | false>>
  /** Set a global's slug to `false` to opt it out of the auto-attached hook. */
  globals?: Partial<Record<string, false>>
  /** Manual dependency rules for flows the automation can't see. See {@link DependencyRule}. */
  rules?: DependencyRule[]
  /** Record cached reads + revalidation events for the dependency map (`/api/revalidate-map`
   *  and the dev-tools view). @default `NODE_ENV === 'development'` */
  observe?: boolean
  /** Register the `GET`/`POST /api/revalidate-map` endpoint (it 404s outside dev unless
   *  `observe` is forced on). @default true */
  endpoint?: boolean
}

/** Options with defaults applied (internal). */
export interface ResolvedRevalidateOptions {
  enabled: boolean
  prefix: string
  collections: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals: Partial<Record<string, false>>
  rules: DependencyRule[]
  observe: boolean
  endpoint: boolean
}
