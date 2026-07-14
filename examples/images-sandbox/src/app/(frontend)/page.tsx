import config from '@payload-config'
import { getPayload } from 'payload'
import type { CSSProperties } from 'react'
import type { AspectRatio } from '@pro-laico/payload-images'
import { getImageUrl } from '@pro-laico/payload-images/utils/urls'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { shellProps } from './shell'
import { Image } from '../../components/Image'
import type { ImageListItem, PageDoc } from '../../types'

const SEEDED_SLUGS = ['images', 'pages']

const RATIOS: { label: string; ar?: AspectRatio }[] = [
  { label: 'natural' },
  { label: '16:9', ar: '16:9' },
  { label: '1:1', ar: '1:1' },
  { label: '9:16', ar: '9:16' },
]

const TILE_SIZES = '(max-width: 920px) 45vw, 200px'

const ratiosGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }
const ratioTile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)' }
const ratioLabel: CSSProperties = {
  display: 'block',
  padding: '6px 8px',
  fontSize: '0.72rem',
  color: 'var(--muted)',
  borderTop: '1px solid var(--border)',
}

export default async function HomePage() {
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)

  const images = (
    await payload.find({
      collection: 'images',
      limit: 50,
      depth: 0,
      sort: 'createdAt',
      select: { alt: true, width: true, height: true, focalX: true, focalY: true },
    })
  ).docs as ImageListItem[] //TODO: replace `as` cast with proper typing
  const pages = (await payload.find({ collection: 'pages', limit: 10, depth: 0, sort: 'createdAt' })).docs as PageDoc[] //TODO: replace `as` cast with proper typing

  return (
    <SandboxShell
      {...shellProps}
      lead={
        <>
          Upload stores only the original; every size below is generated <strong>on demand</strong> by the transform endpoint at{' '}
          <code>/api/img/:id</code>, cropped to each image&apos;s focal point, and rendered through <code>&lt;ResponsiveImage&gt;</code> (a
          server-rendered <code>&lt;img&gt;</code> with a baked-in <code>srcset</code>) over an instant <strong>BlurHash</strong> placeholder —
          a string stored on the doc at upload, focal-cropped to each ratio by the read itself.
        </>
      }
    >
      <SeedPanel
        seeded={status.seeded}
        counts={status.counts}
        note={
          <>
            The seed runs through <code>@pro-laico/payload-seed</code>: three real photos (landscape, portrait, square) seed into{' '}
            <code>images</code> with focal points, then a <code>pages</code> doc references one via <code>ref()</code>. You can also upload your
            own at <a href="/admin/collections/images">/admin/collections/images</a>.
          </>
        }
      />

      <h2>
        Images{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({images.length})
        </small>
      </h2>
      {/*TODO: extract into its own component */}
      {images.length === 0 ? (
        <EmptyState>No images yet — seed the database above, or upload your own in the admin.</EmptyState>
      ) : (
        images.map((img) => (
          <div className="shell-card" key={String(img.id)}>
            <div className="shell-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <strong>{img.alt ?? '(no alt)'}</strong>
              <small className="shell-muted">
                {img.width}×{img.height} · focal {img.focalX ?? 50}%/{img.focalY ?? 50}%
              </small>
            </div>
            <div style={ratiosGrid}>
              {RATIOS.map(({ label, ar }) => (
                <div style={ratioTile} key={label}>
                  <Image id={img.id} aspectRatio={ar} image={{ aspectRatio: ar }} sizes={TILE_SIZES} />
                  <small style={ratioLabel}>{label}</small>
                </div>
              ))}
            </div>
            <p className="shell-muted" style={{ margin: '10px 0 0', fontSize: '0.78rem' }}>
              e.g. <code>{getImageUrl(img, { width: 600, aspectRatio: '1:1' })}</code>
            </p>
          </div>
        ))
      )}

      <h2>
        Pages{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({pages.length})
        </small>
      </h2>
      <p className="shell-lead" style={{ marginBottom: 12 }}>
        Confirms the relationship + seed <code>ref()</code> resolution end to end: a <code>pages</code> doc&apos;s <code>heroImage</code> (an{' '}
        <code>upload</code> field to <code>images</code>) rendered through the same component.
      </p>
      {/*TODO: extract into its own component */}
      {pages.length === 0 ? (
        <EmptyState>No pages yet — seed the database above.</EmptyState>
      ) : (
        pages.map((page) => {
          const heroId = typeof page.heroImage === 'object' && page.heroImage ? page.heroImage.id : (page.heroImage ?? undefined)
          return (
            <div className="shell-card" key={String(page.id)}>
              <div className="shell-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <strong>{page.title ?? '(untitled)'}</strong>
                <small className="shell-muted">heroImage → {heroId ? `#${heroId}` : '(none)'}</small>
              </div>
              {heroId ? (
                <Image
                  id={heroId}
                  aspectRatio="16:9"
                  image={{ aspectRatio: '16:9' }}
                  blur={{ quality: 'md' }}
                  sizes="(max-width: 920px) 100vw, 880px"
                />
              ) : (
                <EmptyState>No hero image set.</EmptyState>
              )}
            </div>
          )
        })
      )}

      <h2>How it works</h2>
      <p className="shell-lead" style={{ marginBottom: 12 }}>
        Seed the Sanity-style getter <strong>once</strong> with the app&apos;s Payload handle (<code>src/lib/imageFor.ts</code>) —{' '}
        <code>createImageFor</code> takes the <code>getPayload</code> promise as-is; only <code>fetch()</code> awaits it:
      </p>
      <pre className="shell-code">{`export const imageFor = createImageFor(getPayload({ config }))`}</pre>
      <p className="shell-lead" style={{ margin: '16px 0 12px' }}>
        Then anywhere on the server, chain the declared render and fetch the render-ready doc — it comes back as{' '}
        <code>{'{ id, alt, src, srcset, placeholder }'}</code>:
      </p>
      <pre className="shell-code">{`const img = await imageFor(imageId).aspectRatio('16:9').quality(80).blur('md').fetch()
if (img) return <ResponsiveImage {...img} sizes="50vw" />`}</pre>
      <p className="shell-lead" style={{ margin: '16px 0 12px' }}>
        Under the hood that is <strong>one</strong> <code>findByID</code> declaring the render on the read — the raw contract stays available
        for access-scoped or cached getters:
      </p>
      <pre className="shell-code">{`const doc = await payload.findByID({
  id,
  collection: 'images',
  depth: 0,
  select: RESPONSIVE_IMAGE_SELECT, // alt + src + srcset + placeholder
  context: { image, blur },        // the declared render, verbatim
})`}</pre>
      <p className="shell-lead" style={{ margin: '16px 0 12px' }}>
        The doc carries a finished <code>srcset</code> for <strong>this</strong> render (<code>v=</code> busts immutable caches on file/focal
        edits) and a focal-cropped placeholder — <code>&lt;ResponsiveImage&gt;</code> just paints a plain <code>&lt;img&gt;</code>:
      </p>
      <pre className="shell-code">{`<img
  srcset="/api/img/<id>?w=320&h=180&fit=cover&q=80&fmt=auto&v=1a2b3c 320w, … "
  style="aspect-ratio: 16 / 9; background-image: url(data:image/png;base64,…)"
/>`}</pre>

      {images.length > 0 && (
        <div className="shell-card">
          <h2 style={{ marginTop: 0 }}>See the srcset choose, live</h2>
          <p className="shell-lead" style={{ marginBottom: 16 }}>
            A dedicated page renders one image full-bleed with <code>sizes=&quot;100vw&quot;</code>. Open the Network tab and resize the window
            — the browser fetches a different variant per screen width, no extra code.
          </p>
          <a className="shell-btn" href="/responsive">
            Open the responsive demo →
          </a>
        </div>
      )}
    </SandboxShell>
  )
}
