import { Suspense } from 'react'
import { SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { DocSection } from '@/components/DocSection'
import { getMedia, getPosts, getServices, getStatus } from '@/lib/getters'

export default function HomePage() {
  return (
    <SandboxShell
      title="Seed Sandbox"
      packageName="@pro-laico/payload-seed"
      docsHref="https://payload-plugins.prolaico.com/docs/plugins/payload-seed"
      accent="oklch(0.72 0.18 295)"
      lead={
        <>
          A minimal Payload app for <code>@pro-laico/payload-seed</code>: declarative seed definitions with cross-file <code>ref()</code> edges,
          native uploads via <code>_file</code>, a seeded global, and a circular reference resolved in a second pass.
        </>
      }
    >
      {/* Cached reads, so this prerenders. Seeding busts the tag and the next request re-renders. */}
      <Suspense fallback={<p className="shell-muted">Loading seeded content…</p>}>
        <SeededContent />
      </Suspense>
    </SandboxShell>
  )
}

/** Seed status and the seeded docs, all through cached getters — nothing here reads the database
 * per request, so the whole page prerenders and re-renders when the sandbox tag is busted. */
async function SeededContent() {
  const [status, posts, media, services] = await Promise.all([getStatus(), getPosts(), getMedia(), getServices()])

  return (
    <>
      <SeedPanel seeded={status.seeded} counts={status.counts} />

      <DocSection title="Media" items={media.map((doc) => ({ id: doc.id, primary: doc.alt, secondary: doc.filename }))} />
      <DocSection
        title="Services"
        items={services.map((doc) => ({
          id: doc.id,
          primary: doc.title,
          secondary: (
            <>
              /{doc.slug} — {doc.summary}
            </>
          ),
        }))}
      />
      <DocSection
        title="Posts"
        items={posts.map((doc) => ({
          id: doc.id,
          primary: doc.title,
          secondary: (
            <>
              /{doc.slug} — {doc.excerpt}
            </>
          ),
        }))}
      />
    </>
  )
}
