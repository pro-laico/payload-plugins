import config from '@payload-config'
import { getPayload } from 'payload'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import type { Media, Post, Service } from '@/payload-types'

const SEEDED_SLUGS = ['media', 'services', 'posts']

export default async function HomePage() {
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)

  const posts = (await payload.find({ collection: 'posts', limit: 50, depth: 0, sort: 'createdAt' })).docs as Post[] //TODO: replace `as` cast with proper typing
  const media = (await payload.find({ collection: 'media', limit: 50, depth: 0, sort: 'createdAt' })).docs as Media[] //TODO: replace `as` cast with proper typing
  const services = (await payload.find({ collection: 'services', limit: 50, depth: 0, sort: 'createdAt' })).docs as Service[] //TODO: replace `as` cast with proper typing

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

      {/*TODO: extract into its own component */}
      <h2>
        Media{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({media.length})
        </small>
      </h2>
      {media.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="shell-card">
          {media.map((doc) => (
            <p key={doc.id} style={{ margin: '4px 0' }}>
              <strong>{doc.alt}</strong> <small className="shell-muted">{doc.filename}</small>
            </p>
          ))}
        </div>
      )}

      {/*TODO: extract into its own component */}
      <h2>
        Services{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({services.length})
        </small>
      </h2>
      {services.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="shell-card">
          {services.map((doc) => (
            <p key={doc.id} style={{ margin: '4px 0' }}>
              <strong>{doc.title}</strong>{' '}
              <small className="shell-muted">
                /{doc.slug} — {doc.summary}
              </small>
            </p>
          ))}
        </div>
      )}

      {/*TODO: extract into its own component */}
      <h2>
        Posts{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({posts.length})
        </small>
      </h2>
      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="shell-card">
          {posts.map((doc) => (
            <p key={doc.id} style={{ margin: '4px 0' }}>
              <strong>{doc.title}</strong>{' '}
              <small className="shell-muted">
                /{doc.slug} — {doc.excerpt}
              </small>
            </p>
          ))}
        </div>
      )}
    </SandboxShell>
  )
}
