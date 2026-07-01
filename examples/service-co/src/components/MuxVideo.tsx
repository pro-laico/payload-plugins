'use client'
import MuxPlayer from '@mux/mux-player-react'
import type { MuxPlayback } from '@/lib/types'

/** The payload-mux frontend: play a video from its virtual playback fields. The plugin ships no
 *  player (by design) — this is the few lines an app writes over `@mux/mux-player-react`, fed the
 *  `playbackOptions[0]` row the collection computes on read. Rendered only when a playback id
 *  exists (see the pages), so no credentials → no player, no error. */
export function MuxVideo({ playback, title, className }: { playback: MuxPlayback; title?: string | null; className?: string }) {
  if (!playback.playbackId) return null
  return (
    <MuxPlayer
      className={className}
      playbackId={playback.playbackId}
      // Under a signed policy these virtual URLs arrive JWT-signed; passing them lets the player
      // use them directly. Public playback works from the id alone.
      src={playback.playbackUrl ?? undefined}
      poster={playback.posterUrl ?? undefined}
      metadata={{ video_title: title ?? undefined }}
      streamType="on-demand"
      accentColor="#a65c3e"
      style={{ aspectRatio: '16 / 9', width: '100%', borderRadius: 16, overflow: 'hidden' }}
    />
  )
}
