/**
 * @pro-laico/payload-revalidate — surgical Next.js tag-based cache revalidation for
 * Payload CMS. This entry is server-config-safe (no Next/React imports): the plugin
 * factory, option/marker types, and the tag builders. The read-side helpers live in
 * `@pro-laico/payload-revalidate/cache` (`server-only`).
 */
export { revalidatePlugin, default } from './plugin'
export type { CollectionRevalidateConfig, CollectionSettings, RevalidateMarker } from './types'
export type { DependencyRule } from './types'
export type { PayloadRevalidateMarker } from './types'
export type { ResolvedRevalidateOptions, RevalidatePluginOptions } from './types'
export { tags } from './tags'
export type { ReferenceEdge, ReferenceGraph } from './types'
export type { ObservedRead, RevalidateEvent } from './types'
export { getInspection } from './lib/inspect'
export type { InspectedCollection, RevalidateInspection } from './types'
export type { ScannedGetter } from './types'
export { buildStaticInspection } from './map/build'
export type { MapConfigSource } from './map/build'
export { renderRevalidateMap } from './map/report'
export type { RenderMapOptions } from './types'
