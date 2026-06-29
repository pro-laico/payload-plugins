import type { Asset } from '@mux/mux-node/resources/video/assets.mjs'

type PlaybackPolicy = NonNullable<Asset['playback_ids']>[number]['policy']

/** The subset of the video doc derived from a ready Mux asset. */
export interface MuxAssetMetadata {
  playbackOptions?: Array<{ playbackId: string; playbackPolicy: PlaybackPolicy }>
  aspectRatio?: string
  duration?: number
  maxWidth?: number
  maxHeight?: number
}

/** Map a ready Mux `Asset` onto the video doc's fields: playback ids/policies, a
 *  CSS-friendly aspect ratio (`16:9` → `16/9`), duration, and the video track's max
 *  dimensions. */
export const getAssetMetadata = (asset: Asset): MuxAssetMetadata => {
  const videoTrack = asset.tracks?.find((track) => track.type === 'video')

  return {
    playbackOptions: asset.playback_ids?.map((value) => ({ playbackId: value.id, playbackPolicy: value.policy })),
    aspectRatio: asset.aspect_ratio?.replace(':', '/'),
    duration: asset.duration,
    ...(videoTrack ? { maxWidth: videoTrack.max_width, maxHeight: videoTrack.max_height } : {}),
  }
}
