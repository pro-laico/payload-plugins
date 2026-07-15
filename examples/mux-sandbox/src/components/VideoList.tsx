import { EmptyState } from '@pro-laico/sandbox-shell'

import type { MuxVideo } from '@/payload-types'

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/** The seeded/uploaded videos, one line each: title, duration, and Mux processing status. */
export function VideoList({ videos }: { videos: MuxVideo[] }) {
  if (videos.length === 0) return <EmptyState>No videos yet — seed the database above, or upload a clip in the admin.</EmptyState>
  return (
    <div className="shell-card">
      {videos.map((doc) => (
        <p key={doc.id} style={{ margin: '4px 0' }}>
          <strong>{doc.title}</strong>{' '}
          <small className="shell-muted">
            {doc.duration ? `${formatDuration(doc.duration)} · ` : ''}
            {doc.status ?? 'preparing'}
          </small>
        </p>
      ))}
    </div>
  )
}
