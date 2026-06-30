import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { seed } from '@pro-laico/payload-seed'
import { getImageUrl, ResponsiveImage } from '@pro-laico/payload-images/components/image'
import { seedOptions } from '@/plugins'

type ImageDoc = {
  id: string | number
  alt?: string | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  filename?: string | null
  url?: string | null
}

type PageDoc = { id: string | number; title?: string | null; heroImage?: ImageDoc | string | null }

// The crops the demo renders for each source — all cut to the image's focal point, so an
// off-center subject stays in frame whether the box is wide, square, or tall.
const RATIOS: { label: string; ar?: string }[] = [
  { label: 'natural' },
  { label: '16:9', ar: '16:9' },
  { label: '1:1', ar: '1:1' },
  { label: '9:16', ar: '9:16' },
]

const TILE_SIZES = '(max-width: 920px) 45vw, 200px'

async function seedAction(): Promise<void> {
  'use server'
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (user) await seed({ payload, options: seedOptions })
  revalidatePath('/')
}

async function resetAction(): Promise<void> {
  'use server'
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (user) {
    // Deleting images cascades their variants via the collection's beforeDelete hook.
    await payload.delete({ collection: 'images', where: { id: { exists: true } }, overrideAccess: true })
    await payload.delete({ collection: 'generated-images', where: { id: { exists: true } }, overrideAccess: true })
    await payload.delete({ collection: 'pages', where: { id: { exists: true } }, overrideAccess: true })
  }
  revalidatePath('/')
}

export default async function HomePage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  const isLoggedIn = Boolean(user)

  const images = (await payload.find({ collection: 'images', limit: 50, depth: 0, sort: 'createdAt', overrideAccess: true })).docs as ImageDoc[]
  const pages = (await payload.find({ collection: 'pages', limit: 10, depth: 1, sort: 'createdAt', overrideAccess: true })).docs as PageDoc[]

  return (
    <main>
      <h1>Payload Images — Sandbox</h1>
      <p className="lead">
        A visual test harness for <code>@pro-laico/payload-images</code>. Upload stores only the original; every size below is generated{' '}
        <strong>on demand</strong> by the transform endpoint at <code>/api/img/:id</code>, cropped to each image&apos;s focal point, and
        rendered through <code>&lt;ResponsiveImage&gt;</code> (a server-rendered <code>&lt;img&gt;</code> with a baked-in <code>srcset</code>)
        over a low-res blur built from the smallest variant.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Seed sample data</h2>
        {isLoggedIn ? (
          <div className="row">
            <form className="seed" action={seedAction}>
              <button className="seed-btn" type="submit">
                Seed sample images + page
              </button>
            </form>
            <form className="seed" action={resetAction}>
              <button className="seed-btn seed-btn--danger" type="submit">
                Reset (delete all)
              </button>
            </form>
            <a className="seed-btn seed-btn--ghost" href="/admin">
              Open admin →
            </a>
          </div>
        ) : (
          <p className="empty">
            <a href="/admin">Log in to /admin</a> first — seeding requires an authenticated user. You can also upload your own at{' '}
            <a href="/admin/collections/images">/admin/collections/images</a>.
          </p>
        )}
        <p className="empty" style={{ marginTop: 12, marginBottom: 0 }}>
          The seed runs through <code>@pro-laico/payload-seed</code>: three real photos (landscape, portrait, square) upload into{' '}
          <code>images</code> with focal points, then a <code>pages</code> doc references one via <code>asset()</code> — the same data the admin{' '}
          <strong>Seed your database</strong> button creates.
        </p>
      </div>

      <h2>
        Images <small style={{ color: 'var(--muted)', fontWeight: 400 }}>({images.length})</small>
      </h2>
      {images.length === 0 ? (
        <p className="empty">No images yet. Seed sample data above, or upload your own in the admin.</p>
      ) : (
        images.map((img) => (
          <div className="card" key={String(img.id)}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <strong>{img.alt ?? '(no alt)'}</strong>
              <small style={{ color: 'var(--muted)' }}>
                {img.width}×{img.height} · focal {img.focalX ?? 50}%/{img.focalY ?? 50}%
              </small>
            </div>
            <div className="ratios">
              {RATIOS.map(({ label, ar }) => (
                <div className="ratio" key={label}>
                  <ResponsiveImage image={img} aspectRatio={ar} sizes={TILE_SIZES} />
                  <small>{label}</small>
                </div>
              ))}
            </div>
            <p className="empty" style={{ margin: '10px 0 0', fontSize: '0.78rem' }}>
              e.g. <code>{getImageUrl(img, { width: 600, aspectRatio: '1:1' })}</code>
            </p>
          </div>
        ))
      )}

      <h2>
        Pages <small style={{ color: 'var(--muted)', fontWeight: 400 }}>({pages.length})</small>
      </h2>
      <p className="lead" style={{ marginBottom: 12 }}>
        Confirms the relationship + seed <code>asset()</code> resolution end to end: a <code>pages</code> doc&apos;s <code>heroImage</code> (an{' '}
        <code>upload</code> field to <code>images</code>) rendered through the same component.
      </p>
      {pages.length === 0 ? (
        <p className="empty">No pages yet. Seed sample data above.</p>
      ) : (
        pages.map((page) => {
          const hero = page.heroImage && typeof page.heroImage === 'object' ? page.heroImage : undefined
          return (
            <div className="card" key={String(page.id)}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <strong>{page.title ?? '(untitled)'}</strong>
                <small style={{ color: 'var(--muted)' }}>heroImage → {hero ? (hero.alt ?? hero.filename) : '(none)'}</small>
              </div>
              {hero ? (
                <ResponsiveImage image={hero} aspectRatio="16:9" sizes="(max-width: 920px) 100vw, 880px" />
              ) : (
                <p className="empty">No hero image set.</p>
              )}
            </div>
          )
        })
      )}

      <h2>How it works</h2>
      <pre className="code">{`import { ResponsiveImage } from '@pro-laico/payload-images/components/image'

// In any server or client component, pass a populated doc (or just its id):
<ResponsiveImage image={image} aspectRatio="16:9" sizes="(max-width: 768px) 100vw, 50vw" />

// Emits a plain <img> whose srcset points at the transform endpoint (the v= token is
// derived from the source's filename + focal, so editing either busts immutable caches):
//   <img
//     srcset="/api/img/<id>?w=320&h=180&fit=cover&q=75&fmt=auto&v=1a2b3c 320w, … "
//     sizes="(max-width: 768px) 100vw, 50vw"
//     style="aspect-ratio: 1.777…"
//   />`}</pre>

      {images.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>See the srcset choose, live</h2>
          <p className="lead" style={{ marginBottom: 16 }}>
            A dedicated page renders one image full-bleed with <code>sizes=&quot;100vw&quot;</code>. Open the Network tab and resize the window
            — the browser fetches a different variant per screen width, no extra code.
          </p>
          <a className="seed-btn" href="/responsive">
            Open the responsive demo →
          </a>
        </div>
      )}
    </main>
  )
}
