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
export { createTags } from './lib/tags'
export { readRevalidateMarker, tagsFor } from './lib/marker'
export type { Tags } from './types'
export type { ReferenceEdge, ReferenceGraph } from './types'
export type { ObservedRead, RevalidateEvent } from './types'
export { getInspection } from './lib/inspect'
export type { InspectedCollection, RevalidateInspection } from './types'
export type { ScannedGetter } from './types'
export { buildStaticInspection } from './lib/map/build'
export type { MapConfigSource } from './lib/map/build'
export { renderRevalidateMap } from './lib/map/report'
export type { RenderMapOptions } from './types'
