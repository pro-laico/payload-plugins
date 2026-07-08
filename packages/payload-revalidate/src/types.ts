import type { RevalidatePluginOptions } from './options'

/**
 * Per-collection revalidation settings. Two ways to set them, same shape:
 *
 * 1. Plugin options: `revalidatePlugin({ collections: { posts: { listFields: ['featured'] } } })`
 * 2. The collection's own `custom.revalidate` marker — plain config, no import of this
 *    package needed, so other plugins ship revalidation defaults for their collections
 *    fully decoupled (the `custom.seedAsset` / `custom.seedDisabled` pattern):
 *
 *    `{ slug: 'mux-video', custom: { revalidate: { extraTags: ['video-embeds'] } }, ... }`
 *
 * Plugin options win over the marker, field by field. `false` (either place) opts the
 * collection out entirely — no hooks attached.
 */
export interface CollectionRevalidateConfig {
  /**
   * The field whose value doubles as a doc tag alias (`{slug}:{value}`), so reads keyed
   * by it — `getPost(slug)` — can tag before the id is known, including cached misses.
   * `false` disables alias tags. @default `'slug'` when the collection has a `slug` field
   */
  idField?: string | false
  /**
   * The collection's declared list scopes, keyed by scope name, each naming the top-level
   * fields that determine its membership/order (sort + filter fields). An id-list read
   * (`cacheIds(res, 'posts', { list: 'recent' })`) carries `posts:list:recent`; the hooks
   * bust it on membership events (create/delete/publish/unpublish) and whenever one of
   * its declared fields changes — a `body` edit never touches it.
   *
   * @example
   * ```ts
   * lists: { recent: { fields: ['publishedAt'] }, featured: { fields: ['featured', 'publishedAt'] } }
   * ```
   */
  lists?: Record<string, { fields: string[] }>
  /** Static extra tags busted on every published write of this collection (e.g. `'sitemap'`). */
  extraTags?: string[]
}

/**
 * A collection's `custom.revalidate` marker: `false` opts out of the auto-attached hooks,
 * an object supplies {@link CollectionRevalidateConfig} defaults. See that type for the
 * decoupling story.
 */
export type RevalidateMarker = false | CollectionRevalidateConfig

/**
 * A manual dependency rule — the escape hatch for data flows the automation can't see
 * (content rendered downstream of an untagged read). When a doc in `on` changes, the
 * listed tags are busted too, optionally gated on which top-level fields changed.
 *
 * @example
 * ```ts
 * // FAQ text is baked into service pages by a build step the walk can't observe:
 * rules: [{ on: 'faqs', bust: ['services'], whenFields: ['question', 'answer'] }]
 * ```
 */
export interface DependencyRule {
  /** Source collection slug that triggers the rule. */
  on: string
  /** Tags to bust when it fires (built by hand or with {@link tags}). */
  bust: string[]
  /** Only fire when one of these top-level fields changed (deletes always fire). */
  whenFields?: string[]
}

/**
 * The `config.custom.payloadRevalidate` discovery marker — how decoupled tooling
 * (e.g. `@pro-laico/payload-dev-tools`) detects the plugin and finds its endpoint from
 * just `payload.config`, no import. Data-only; live inspection goes through the
 * `Symbol.for('pro-laico.payload-revalidate.inspect')` globalThis slot instead
 * (functions don't belong on `custom` — it feeds the serialized client config).
 */
export interface PayloadRevalidateMarker {
  options: RevalidatePluginOptions
  /** Where `GET`/`POST /api{endpointPath}` serves the map, or `null` when disabled. */
  endpointPath: string | null
}
