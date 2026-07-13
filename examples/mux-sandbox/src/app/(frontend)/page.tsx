import config from '@payload-config'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'
import { getPayload } from 'payload'
import type { VideoDoc } from '@/types'

// The slugs the seed definitions in src/seed/ create.
const SEEDED_SLUGS = ['mux-video', 'pages']

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export default async function HomePage() {
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)

  const videos = (await payload.find({ collection: 'mux-video', limit: 50, depth: 0, sort: 'createdAt' })).docs as VideoDoc[]

  return (
    <SandboxShell
      title="Mux Sandbox"
      packageName="@pro-laico/payload-mux"
      docsHref="https://payload-plugins.prolaico.com/docs/plugins/payload-mux"
      accent="oklch(0.72 0.16 15)"
      lead={
        <>
          A minimal Payload app for <code>@pro-laico/payload-mux</code>. Open the <a href="/admin">admin panel</a>, go to{' '}
          <strong>Videos</strong>, and upload a clip (needs real Mux credentials in <code>.env.local</code>).
        </>
      }
    >
      <SeedPanel
        seeded={status.seeded}
        counts={status.counts}
        note={
          <>
            Seeding the sample clip needs <code>MUX_TOKEN_ID</code> / <code>MUX_TOKEN_SECRET</code> in <code>.env.local</code> — without them
            the seed engine skips videos with a warning (that&apos;s expected).
          </>
        }
      />

      <h2>
        Videos{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({videos.length})
        </small>
      </h2>
      {videos.length === 0 ? (
        <EmptyState>No videos yet — seed the database above, or upload a clip in the admin.</EmptyState>
      ) : (
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
      )}
    </SandboxShell>
  )
}
