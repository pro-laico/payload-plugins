/** The fields `getAssetMetadata` reads, shared by the Mux `Asset` (from the assets API) and
 *  the asset webhook event `data` — both satisfy this structurally, so callers pass either
 *  without a cast. */
export interface AssetLike {
  playback_ids?: Array<{ id: string; policy: 'public' | 'signed' | 'drm' }> | null
  aspect_ratio?: string | null
  duration?: number | null
  tracks?: ReadonlyArray<{ type?: string; max_width?: number; max_height?: number }> | null
}

/** The subset of the video doc derived from a ready Mux asset. */
export interface MuxAssetMetadata {
  playbackOptions?: Array<{ playbackId: string; playbackPolicy: 'public' | 'signed' | 'drm' }>
  aspectRatio?: string
  duration?: number
  maxWidth?: number
  maxHeight?: number
}

/** Map a ready Mux asset (or asset webhook payload) onto the video doc's fields: playback
 *  ids/policies, a CSS-friendly aspect ratio (`16:9` → `16/9`), duration, and the video
 *  track's max dimensions. */
export const getAssetMetadata = (asset: AssetLike): MuxAssetMetadata => {
  const videoTrack = asset.tracks?.find((track) => track.type === 'video')

  return {
    playbackOptions: asset.playback_ids?.map((value) => ({ playbackId: value.id, playbackPolicy: value.policy })),
    aspectRatio: asset.aspect_ratio?.replace(':', '/'),
    duration: asset.duration ?? undefined,
    ...(videoTrack ? { maxWidth: videoTrack.max_width, maxHeight: videoTrack.max_height } : {}),
  }
}
