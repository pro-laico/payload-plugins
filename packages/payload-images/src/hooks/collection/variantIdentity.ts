/**
 * The one definition of "this change invalidates the source's variants": file replaced, focal
 * moved, or hotspot edited — the same field set `variantCacheKey` hashes. Shared by the purge
 * hook (drop stale variants) and the prewarm hook (re-generate them) so the triggers can't drift.
 */

export interface VariantIdentityChange {
  fileChanged: boolean
  focalChanged: boolean
  hotspotChanged: boolean
  any: boolean
}

type DocLike = Record<string, unknown> | undefined

export const detectVariantIdentityChange = (previousDoc: DocLike, doc: DocLike): VariantIdentityChange => {
  const fileChanged = previousDoc?.filename !== doc?.filename
  const focalChanged = previousDoc?.focalX !== doc?.focalX || previousDoc?.focalY !== doc?.focalY
  const hotspotChanged = (['focalSize', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom'] as const).some(
    (f) => (previousDoc?.[f] ?? null) !== (doc?.[f] ?? null),
  )
  return { fileChanged, focalChanged, hotspotChanged, any: fileChanged || focalChanged || hotspotChanged }
}
