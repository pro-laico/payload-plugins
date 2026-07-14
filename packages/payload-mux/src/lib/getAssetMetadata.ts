import type { AssetLike, MuxAssetMetadata } from '../types'

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
