import config from '@payload-config'
import { type CollectionSlug, getPayload } from 'payload'
import { getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { DocSection } from '@/components/DocSection'

const SEEDED_SLUGS: CollectionSlug[] = ['media', 'services', 'posts']

export default async function HomePage() {
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)

  const posts = (await payload.find({ collection: 'posts', limit: 50, depth: 0, sort: 'createdAt' })).docs
  const media = (await payload.find({ collection: 'media', limit: 50, depth: 0, sort: 'createdAt' })).docs
  const services = (await payload.find({ collection: 'services', limit: 50, depth: 0, sort: 'createdAt' })).docs

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
    </SandboxShell>
  )
}
