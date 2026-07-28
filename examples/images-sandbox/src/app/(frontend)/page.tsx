import { Suspense } from 'react'
import { EmptyState, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { shellProps } from './shell'
import { getImageCount, getImages, getPages, getStatus } from '@/lib/getters'
import { PageCard } from '../../components/PageCard'
import { ImageCard } from '../../components/ImageCard'

export default function HomePage() {
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
      {/* Live reads (seed status, the seeded images/pages) are a dynamic hole inside Suspense — the shell around them prerenders. */}
      <Suspense fallback={<p className="shell-muted">Loading gallery…</p>}>
        <Gallery />
      </Suspense>

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

      {/* Whether to show the live-demo link depends on a live read too — another dynamic hole. */}
      <Suspense fallback={null}>
        <ResponsiveDemoLink />
      </Suspense>
    </SandboxShell>
  )
}

/** Seed status, the seeded images, and the pages that reference them — all cached getters, read
 * per change rather than per request, so the gallery prerenders. */
async function Gallery() {
  const [status, images, pages] = await Promise.all([getStatus(), getImages(), getPages()])

  return (
    <>
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
        images.map((img) => <ImageCard img={img} key={String(img.id)} />)
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
        pages.map((page) => <PageCard page={page} key={String(page.id)} />)
      )}
    </>
  )
}

/** The live-demo call-to-action, shown only once at least one image exists. */
async function ResponsiveDemoLink() {
  const totalDocs = await getImageCount()
  if (totalDocs === 0) return null

  return (
    <div className="shell-card">
      <h2 style={{ marginTop: 0 }}>See the srcset choose, live</h2>
      <p className="shell-lead" style={{ marginBottom: 16 }}>
        A dedicated page renders one image full-bleed with <code>sizes=&quot;100vw&quot;</code>. Open the Network tab and resize the window —
        the browser fetches a different variant per screen width, no extra code.
      </p>
      <a className="shell-btn" href="/responsive">
        Open the responsive demo →
      </a>
    </div>
  )
}
