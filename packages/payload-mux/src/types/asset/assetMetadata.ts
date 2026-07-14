export interface AssetLike {
  playback_ids?: Array<{ id: string; policy: 'public' | 'signed' | 'drm' }> | null
  aspect_ratio?: string | null
  duration?: number | null
  tracks?: ReadonlyArray<{ type?: string; max_width?: number; max_height?: number }> | null
}

export interface MuxAssetMetadata {
  playbackOptions?: Array<{ playbackId: string; playbackPolicy: 'public' | 'signed' }>
  aspectRatio?: string
  duration?: number
  maxWidth?: number
  maxHeight?: number
}
