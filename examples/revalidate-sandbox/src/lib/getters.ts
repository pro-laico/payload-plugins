import config from '@payload-config'
import { type ImageRenderContext, RESPONSIVE_IMAGE_SELECT } from '@pro-laico/payload-images'
import { createCacheHelpers } from '@pro-laico/payload-revalidate/cache'
import { getPayload } from 'payload'
import type { Image, Media, Post, Service, SiteSetting } from '@/payload-types'

// The ONE live Payload session (getPayload memoizes) — seeds the cache helpers and every
// getter below, so the session that fetches a doc is the session that tags it.
const db = getPayload({ config })
const { cacheDoc, cacheGlobal, cacheIds } = createCacheHelpers(db)

// The atomic pattern @pro-laico/payload-revalidate is built around:
// - lists fetch IDS ONLY (cacheIds) — their entries change on membership/order, never on content
// - every doc renders through an id-keyed getter (cacheDoc) — ITS entry is the only thing a
//   content edit re-materializes
// - references stay ids (depth: 0); the component that renders a reference self-fetches
// The result: edit a media alt → exactly one entry (getMedia's) re-renders, everywhere it's used.

export async function getPostIds(): Promise<(string | number)[]> {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'posts', sort: '-createdAt', limit: 50, depth: 0, select: {}, overrideAccess: false })
  await cacheIds(res, 'posts', { label: 'post-ids' })
  return res.docs.map((doc) => doc.id)
}

export async function getFeaturedPostIds(): Promise<(string | number)[]> {
  'use cache'
  const payload = await db
  const res = await payload.find({
    collection: 'posts',
    where: { featured: { equals: true } },
    sort: '-createdAt',
    limit: 12,
    depth: 0,
    select: {},
    overrideAccess: false,
  })
  await cacheIds(res, 'posts', { list: 'featured', label: 'featured-post-ids' })
  return res.docs.map((doc) => doc.id)
}

export async function getPost(id: string | number): Promise<Post | null> {
  'use cache'
  const payload = await db
  const doc = (await payload.findByID({ collection: 'posts', id, depth: 0, disableErrors: true, overrideAccess: false })) as Post | null
  return cacheDoc(doc, 'posts', { label: 'post-by-id' })
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: false })
  return cacheDoc((res.docs[0] as Post | undefined) ?? null, 'posts', { as: slug, label: 'post-by-slug' })
}

export async function getServiceIds(): Promise<(string | number)[]> {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'services', sort: 'title', limit: 50, depth: 0, select: {}, overrideAccess: false })
  await cacheIds(res, 'services', { label: 'service-ids' })
  return res.docs.map((doc) => doc.id)
}

export async function getService(id: string | number): Promise<Service | null> {
  'use cache'
  const payload = await db
  const doc = (await payload.findByID({ collection: 'services', id, depth: 0, disableErrors: true, overrideAccess: false })) as Service | null
  return cacheDoc(doc, 'services', { label: 'service-by-id' })
}

/** The @pro-laico/payload-images integration: the images doc is an ordinary id-keyed
 *  cacheDoc entry — `<ResponsiveImage image={doc} />` renders FROM it, so an alt/focal
 *  edit busts `images:{id}` and exactly this entry re-materializes (with fresh `v=`
 *  tokens in the srcset, so the binary variants re-derive too). The render context
 *  (`{ image, blur }`) declares what's being rendered, so the doc arrives with
 *  `src`/`srcset`/`placeholder` finished for it; 'use cache' keys on the args, one
 *  entry per (id, render). */
export async function getImage(id: string | number, render?: ImageRenderContext): Promise<Image | null> {
  'use cache'
  const payload = await db
  const doc = (await payload.findByID({
    collection: 'images',
    id,
    depth: 0,
    select: RESPONSIVE_IMAGE_SELECT,
    context: { ...render },
    disableErrors: true,
    overrideAccess: false,
  })) as Image | null
  return cacheDoc(doc, 'images', { label: 'image-by-id' })
}

export async function getImageIds(): Promise<(string | number)[]> {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'images', sort: '-createdAt', limit: 12, depth: 0, select: {}, overrideAccess: false })
  await cacheIds(res, 'images', { label: 'image-ids' })
  return res.docs.map((doc) => doc.id)
}

export async function getMedia(id: string | number): Promise<Media | null> {
  'use cache'
  const payload = await db
  const doc = (await payload.findByID({ collection: 'media', id, depth: 0, disableErrors: true, overrideAccess: false })) as Media | null
  return cacheDoc(doc, 'media', { label: 'media-by-id' })
}

export async function getSettings(): Promise<SiteSetting> {
  'use cache'
  const payload = await db
  return cacheGlobal((await payload.findGlobal({ slug: 'site-settings', depth: 0 })) as SiteSetting, 'site-settings')
}
