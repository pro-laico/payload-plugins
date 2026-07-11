import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Icon } from '@pro-laico/payload-icons/components/Icon'
import { ResponsiveImage } from '@pro-laico/payload-images/components/image'
import { SandboxShell } from '@pro-laico/sandbox-shell'
import { getFeaturedPostIds, getImage, getImageIds, getPost, getPostIds, getService, getServiceIds } from '@/lib/getters'

export default function HomePage() {
  return (
    <SandboxShell
      title="Revalidate Sandbox"
      packageName="@pro-laico/payload-revalidate"
      docsHref="https://payload-plugins.prolaico.com/docs/plugins/payload-revalidate"
      accent="oklch(0.72 0.15 160)"
      lead={
        <>
          Atomic revalidation: the lists below cache <em>ids only</em> (<code>cacheIds</code>); every card self-fetches through an id-keyed{' '}
          <code>cacheDoc</code> getter. Edit a post's title and exactly one card entry re-materializes — the lists and every other card survive.
          Watch it at <Link href="/dev/revalidate">/dev/revalidate</Link>.
        </>
      }
    >
      <Suspense fallback={<p className="shell-muted">Loading cached content…</p>}>
        <Content />
      </Suspense>
    </SandboxShell>
  )
}

async function Content() {
  // Request-time shell: the page composes at request time from the CACHED getter entries
  // below (that's the atomic model), and the build never queries the database.
  await connection()
  const [postIds, featuredIds, serviceIds, imageIds] = await Promise.all([getPostIds(), getFeaturedPostIds(), getServiceIds(), getImageIds()])
  return (
    <>
      <h2>
        Featured posts{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({featuredIds.length}) — id-list tagged posts:list:featured; flips of `featured` bust ONLY this
        </small>
      </h2>
      <div className="shell-card">
        {featuredIds.length === 0 ? (
          <p className="shell-muted" style={{ margin: '4px 0' }}>
            Nothing featured.
          </p>
        ) : (
          featuredIds.map((id) => <PostCard key={id} id={id} />)
        )}
      </div>

      <h2>
        Posts{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({postIds.length}) — id-list tagged posts; membership events bust it, content edits never do
        </small>
      </h2>
      <div className="shell-card">
        {postIds.length === 0 ? (
          <p className="shell-muted" style={{ margin: '4px 0' }}>
            Nothing yet — seed via the admin button or <Link href="/dev">/dev</Link>.
          </p>
        ) : (
          postIds.map((id) => <PostCard key={id} id={id} />)
        )}
      </div>

      <h2>
        Services{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({serviceIds.length})
        </small>
      </h2>
      <div className="shell-card">
        {serviceIds.map((id) => (
          <ServiceRow key={id} id={id} />
        ))}
      </div>

      <h2>
        Images{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          (@pro-laico/payload-images) — each doc an id-keyed cacheDoc entry; an alt/focal edit busts images:&#123;id&#125; and only that entry
        </small>
      </h2>
      <div className="shell-card">
        {imageIds.length === 0 ? (
          <p className="shell-muted" style={{ margin: '4px 0' }}>
            No images yet — seed via the admin button or <Link href="/dev">/dev</Link>.
          </p>
        ) : (
          imageIds.map((id) => <ImageCard key={id} id={id} />)
        )}
      </div>

      <h2>
        Icons{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          (@pro-laico/payload-icons) — a 'use cache' scope inlining icons; any icon/set write busts the shared payload-icons tag
        </small>
      </h2>
      <div className="shell-card">
        <CachedIconPanel />
      </div>

      <p className="shell-muted">
        The dependency graph, per-field blast radii, observed reads, and the bust-event log live at{' '}
        <Link href="/dev/revalidate">/dev/revalidate</Link> (or <code>GET /api/revalidate-map</code>).
      </p>
    </>
  )
}

/** One post card = one cache entry (`getPost(id)` → tagged posts:{id}). Editing this
 *  post re-materializes exactly this card's DATA entry, nowhere else. The card prints the
 *  doc's own `updatedAt` (the component itself is dynamic glue and re-renders per request
 *  — a render timestamp here would change on every reload and demonstrate nothing). */
async function PostCard({ id }: { id: string | number }) {
  const post = await getPost(id)
  if (!post) return null
  return (
    <p style={{ margin: '4px 0' }}>
      <Link href={`/posts/${post.slug}`}>
        <strong>{post.title}</strong>
      </Link>{' '}
      <small className="shell-muted">
        /{post.slug}
        {post.featured ? ' · featured' : ''} — entry posts:{post.id}, doc updated {new Date(post.updatedAt).toLocaleTimeString()}
      </small>
    </p>
  )
}

/** One image = one cache entry (`getImage(id, render)` → tagged images:{id}). The getter
 *  declares the render, so the cached doc carries a finished src/srcset/placeholder for this
 *  exact box — an alt or focal-point edit re-materializes exactly this entry (with fresh `v=`
 *  tokens, so the derived binary variants refresh too). */
async function ImageCard({ id }: { id: string | number }) {
  const image = await getImage(id, { image: { aspectRatio: '16:9' } })
  if (!image) return null
  return (
    <div style={{ margin: '4px 0', maxWidth: 420 }}>
      <ResponsiveImage
        id={image.id}
        alt={image.alt ?? ''}
        src={image.src}
        srcset={image.srcset}
        placeholder={image.placeholder}
        aspectRatio="16:9"
        sizes="420px"
        style={{ borderRadius: 8 }}
      />
      <small className="shell-muted">
        {image.alt} — entry tagged images:{image.id}
      </small>
    </div>
  )
}

/** A cached scope that INLINES icons — the case the shared `payload-icons` tag exists for.
 *  `getIconSvg` (inside `<Icon>`) detects payload-revalidate and tags this entry; the
 *  icon/iconSet collections carry the matching `extraTags` marker, so re-uploading an SVG,
 *  remapping a name, or activating a different set re-materializes this panel. */
async function CachedIconPanel() {
  'use cache'
  return (
    <p style={{ alignItems: 'center', display: 'flex', gap: 12, margin: '4px 0' }}>
      {['arrow-right', 'check', 'star'].map((name) => (
        <Icon key={name} name={name} style={{ height: 24, width: 24 }} />
      ))}
      <small className="shell-muted">baked-in SVGs — panel entry materialized {new Date().toLocaleTimeString()}</small>
    </p>
  )
}

async function ServiceRow({ id }: { id: string | number }) {
  const service = await getService(id)
  if (!service) return null
  return (
    <p style={{ margin: '4px 0' }}>
      <strong>{service.title}</strong> <small className="shell-muted">/{service.slug}</small>
    </p>
  )
}
