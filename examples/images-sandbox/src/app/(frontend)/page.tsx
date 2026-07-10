import config from '@payload-config'
import { getImageUrl } from '@pro-laico/payload-images/components/image'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'
import { getPayload } from 'payload'
import type { CSSProperties } from 'react'
import { Image } from '../../components/Image'
import { shellProps } from './shell'

// The slugs the seed definitions in src/seed/ fill.
const SEEDED_SLUGS = ['images', 'pages']

// The page-level list read is a light projection for the card headers; the pixels + placeholder
// are each tile's own concern — <Image id> self-fetches exactly what it renders.
type ImageListItem = {
  id: string | number
  alt?: string | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
}

type PageDoc = { id: string | number; title?: string | null; heroImage?: { id: string | number } | string | number | null }

// The crops the demo renders for each source — all cut to the image's focal point, so an
// off-center subject stays in frame whether the box is wide, square, or tall.
const RATIOS: { label: string; ar?: string }[] = [
  { label: 'natural' },
  { label: '16:9', ar: '16:9' },
  { label: '1:1', ar: '1:1' },
  { label: '9:16', ar: '9:16' },
]

const TILE_SIZES = '(max-width: 920px) 45vw, 200px'

// Demo-only chrome (the focal-crop ratio grid) — everything else rides the shell classes/tokens.
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
      overrideAccess: true,
    })
  ).docs as ImageListItem[]
  const pages = (await payload.find({ collection: 'pages', limit: 10, depth: 0, sort: 'createdAt', overrideAccess: true })).docs as PageDoc[]

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
                  <Image id={img.id} aspectRatio={ar} sizes={TILE_SIZES} />
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
      {pages.length === 0 ? (
        <EmptyState>No pages yet — seed the database above.</EmptyState>
      ) : (
        pages.map((page) => {
          // depth 0 → heroImage is the bare id; <Image> owns fetching what it renders.
          const heroId = typeof page.heroImage === 'object' && page.heroImage ? page.heroImage.id : (page.heroImage ?? undefined)
          return (
            <div className="shell-card" key={String(page.id)}>
              <div className="shell-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <strong>{page.title ?? '(untitled)'}</strong>
                <small className="shell-muted">heroImage → {heroId ? `#${heroId}` : '(none)'}</small>
              </div>
              {heroId ? (
                <Image id={heroId} aspectRatio="16:9" sizes="(max-width: 920px) 100vw, 880px" blurhashQuality="md" />
              ) : (
                <EmptyState>No hero image set.</EmptyState>
              )}
            </div>
          )
        })
      )}

      <h2>How it works</h2>
      <pre className="shell-code">{`// The project owns one <Image> component (src/components/Image.tsx): pass an id + presentation
// props; it fetches its own doc — leanest possible read — and hands everything to the passive
// <ResponsiveImage>:
<Image id={imageId} aspectRatio="16:9" sizes="(max-width: 768px) 100vw, 50vw" />

// Inside it:
const doc = await payload.findByID({
  collection: 'images',
  id,
  depth: 0,
  select: { alt: true, width: true, height: true, croppedBlurHash: true, variantVersion: true },
  context: { blurhash: { ar: aspectRatio, quality: 'sm' } }, // placeholder arrives as a finished data URI, cropped to this ratio
})
return <ResponsiveImage image={doc} aspectRatio={aspectRatio} {...rest} />

// <ResponsiveImage> emits a plain <img>: srcset → the transform endpoint (v= busts immutable
// caches on file/focal edits), background → the croppedBlurHash data URI, as-is:
//   <img
//     srcset="/api/img/<id>?w=320&h=180&fit=cover&q=75&fmt=auto&v=1a2b3c 320w, … "
//     style="aspect-ratio: 1.777…; background-image: url(data:image/png;base64,…)"
//   />`}</pre>

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
