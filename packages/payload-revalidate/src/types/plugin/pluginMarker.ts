import type { DependencyRule } from './dependencyRule'
import type { RevalidatePluginOptions } from './pluginOptions'

/**
 * The `config.custom.payloadRevalidate` discovery marker — how decoupled tooling
 * (e.g. `@pro-laico/payload-dev-tools`) detects the plugin, and how the `./cache` helpers
 * read the resolved plugin state off the handle the app passes them (`payload.config`) —
 * no import, no global stash. Data-only (it feeds the serialized client config); live
 * inspection goes through the `Symbol.for('pro-laico.payload-revalidate.inspect')`
 * globalThis slot instead (functions don't belong on `custom`).
 */
export interface PayloadRevalidateMarker {
  options: RevalidatePluginOptions
  /** Where `GET`/`POST /api{endpointPath}` serves the map, or `null` when disabled. */
  endpointPath: string | null
  /** The resolved tag-namespace prefix — every tag the plugin applies or busts carries it. */
  prefix: string
  /** Whether the dev observer records reads/events — the resolved `observe` option. */
  observe: boolean
  /** Per-collection declared list scopes (from `options.collections[slug].lists`) — read by
   *  `cacheIds` (undeclared-scope dev warning) and the after-seed flush (bust every scope). */
  lists: Record<string, string[]>
  /** Per-collection static extra tags (markers + options merged) — the after-seed flush busts
   *  them for touched slugs, since entries carrying ONLY an extra tag (e.g. a scope inlining
   *  icons tagged `payload-icons`) don't carry `all` and would otherwise survive a reseed. */
  extraTags: Record<string, string[]>
  /** The resolved dependency rules — the after-seed flush busts their targets for touched
   *  slugs (same rationale as `extraTags`: rule targets live outside `./cache`, carry no
   *  `all`, and would otherwise survive a reseed). */
  rules: DependencyRule[]
}
