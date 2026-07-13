import type { CollectionSlug } from 'payload'

/** The package's ONE CollectionSlug assertion — every runtime-configured slug funnels through here. */
export const asSlug = (slug: string): CollectionSlug => slug as CollectionSlug //EXCUSE: a runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
