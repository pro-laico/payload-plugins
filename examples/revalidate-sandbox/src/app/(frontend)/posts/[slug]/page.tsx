import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { getMedia, getPostBySlug, getService } from '@/lib/getters'

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Suspense fallback={<p>Loading…</p>}>
        <PostDetail params={params} />
      </Suspense>
    </main>
  )
}

async function PostDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  return (
    <article>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>{post.title}</h1>
      <p>{post.excerpt}</p>
      <ul>
        <li>
          post entry: <code>posts:{post.slug}</code> — doc updated {new Date(post.updatedAt).toLocaleTimeString()}
        </li>
        {typeof post.heroImage === 'number' || typeof post.heroImage === 'string' ? <HeroInfo id={post.heroImage} /> : null}
        {typeof post.relatedService === 'number' || typeof post.relatedService === 'string' ? <RelatedInfo id={post.relatedService} /> : null}
      </ul>
    </article>
  )
}

async function HeroInfo({ id }: { id: string | number }) {
  const media = await getMedia(id)
  if (!media) return null
  return (
    <li>
      hero image: <strong>{media.alt}</strong> — its own entry (<code>media:{media.id}</code>); edit the alt and only THIS line's entry
      re-materializes
    </li>
  )
}

async function RelatedInfo({ id }: { id: string | number }) {
  const service = await getService(id)
  if (!service) return null
  return (
    <li>
      related service: <strong>{service.title}</strong> (<code>services:{service.id}</code>)
    </li>
  )
}
