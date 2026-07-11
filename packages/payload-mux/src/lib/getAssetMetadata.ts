import type { AssetLike, MuxAssetMetadata } from '../types'

/** Map a ready Mux asset (or asset webhook payload) onto the video doc's fields: playback
 *  ids/policies, a CSS-friendly aspect ratio (`16:9` → `16/9`), duration, and the video
 *  track's max dimensions. */
export const getAssetMetadata = (asset: AssetLike): MuxAssetMetadata => {
  const videoTrack = asset.tracks?.find((track) => track.type === 'video')

  return {
    playbackOptions: asset.playback_ids?.map((value) => ({
      playbackId: value.id,
      playbackPolicy: value.policy === 'public' ? 'public' : 'signed',
    })),
    aspectRatio: asset.aspect_ratio?.replace(':', '/'),
    duration: asset.duration ?? undefined,
    ...(videoTrack ? { maxWidth: videoTrack.max_width, maxHeight: videoTrack.max_height } : {}),
  }
}
