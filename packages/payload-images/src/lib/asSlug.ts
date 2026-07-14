import type { CollectionSlug } from 'payload'

export const asSlug = (slug: string): CollectionSlug => slug as CollectionSlug //TODO: replace `as` cast with proper typing
