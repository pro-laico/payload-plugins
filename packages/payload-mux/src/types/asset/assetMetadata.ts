/** The fields `getAssetMetadata` reads, shared by the Mux `Asset` (from the assets API) and
 *  the asset webhook event `data` — both satisfy this structurally, so callers pass either
 *  without a cast. */
export interface AssetLike {
  playback_ids?: Array<{ id: string; policy: 'public' | 'signed' | 'drm' }> | null
  aspect_ratio?: string | null
  duration?: number | null
  tracks?: ReadonlyArray<{ type?: string; max_width?: number; max_height?: number }> | null
}

/** The subset of the video doc derived from a ready Mux asset. The plugin tracks only the two
 *  policies it can build URLs for; a `drm` playback id (rare) is treated as `signed`, since it
 *  too needs a token. */
export interface MuxAssetMetadata {
  playbackOptions?: Array<{ playbackId: string; playbackPolicy: 'public' | 'signed' }>
  aspectRatio?: string
  duration?: number
  maxWidth?: number
  maxHeight?: number
}
