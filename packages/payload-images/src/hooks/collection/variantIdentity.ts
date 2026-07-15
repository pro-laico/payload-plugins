export interface VariantIdentityChange {
  fileChanged: boolean
  focalChanged: boolean
  hotspotChanged: boolean
  any: boolean
}

type DocLike = Record<string, unknown> | undefined

// filesize/width/height catch same-filename byte replacement (overwriteExistingFiles, the admin
// crop tool), which keeps the filename identical. They participate in variantCacheKey and
// deriveVersion too — the three MUST stay in lockstep or stale variants survive a purge.
export const detectVariantIdentityChange = (previousDoc: DocLike, doc: DocLike): VariantIdentityChange => {
  const fileChanged = (['filename', 'filesize', 'width', 'height'] as const).some((f) => (previousDoc?.[f] ?? null) !== (doc?.[f] ?? null))
  const focalChanged = previousDoc?.focalX !== doc?.focalX || previousDoc?.focalY !== doc?.focalY
  const hotspotChanged = (['focalSize', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom'] as const).some(
    (f) => (previousDoc?.[f] ?? null) !== (doc?.[f] ?? null),
  )
  return { fileChanged, focalChanged, hotspotChanged, any: fileChanged || focalChanged || hotspotChanged }
}
