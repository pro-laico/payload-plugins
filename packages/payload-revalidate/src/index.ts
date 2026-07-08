/**
 * @pro-laico/payload-revalidate — surgical Next.js tag-based cache revalidation for
 * Payload CMS. This entry is server-config-safe (no Next/React imports): the plugin
 * factory, option/marker types, and the tag builders. The read-side helpers live in
 * `@pro-laico/payload-revalidate/cache` (`server-only`).
 */
export { revalidatePlugin, default } from './plugin'
export type { CollectionSettings, ResolvedRevalidateOptions, RevalidatePluginOptions } from './options'
export type { CollectionRevalidateConfig, DependencyRule, PayloadRevalidateMarker, RevalidateMarker } from './types'
export { tags } from './tags'
export type { ReferenceEdge, ReferenceGraph } from './graph/referenceGraph'
export type { ObservedRead, RevalidateEvent } from './observe/registry'
export { getInspection } from './lib/inspect'
export type { InspectedCollection, RevalidateInspection } from './lib/inspect'
export type { ScannedGetter } from './scan/live'
