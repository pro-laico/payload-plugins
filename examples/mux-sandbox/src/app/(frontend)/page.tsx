import { Suspense } from 'react'
import { SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { VideoList } from '@/components/VideoList'
import { getStatus, getVideos } from '@/lib/getters'

export default function HomePage() {
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
      {/* Live reads are a dynamic hole inside Suspense — the shell around them prerenders. */}
      <Suspense fallback={<p className="shell-muted">Loading videos…</p>}>
        <Videos />
      </Suspense>
    </SandboxShell>
  )
}

/** Seed status and the seeded videos through cached getters — read per change, not per request. */
async function Videos() {
  const [status, videos] = await Promise.all([getStatus(), getVideos()])

  return (
    <>
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
      <VideoList videos={videos} />
    </>
  )
}
