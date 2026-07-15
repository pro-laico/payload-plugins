import config from '@payload-config'
import { getPayload } from 'payload'
import { createCacheHelpers } from '@pro-laico/payload-revalidate/cache'
import { type ImageRenderContext, RESPONSIVE_IMAGE_SELECT, type ResponsiveImageDoc } from '@pro-laico/payload-images'

import type { Media, Post, Service, SiteSetting } from '@/payload-types'

const db = getPayload({ config })
const { findDoc, findDocByID, findGlobal, findIds } = createCacheHelpers(db)

export async function getPostIds(): Promise<(string | number)[]> {
  'use cache'
  return (await findIds('posts', { sort: '-createdAt', limit: 50 })).ids
}

export async function getFeaturedPostIds(): Promise<(string | number)[]> {
  'use cache'
  const res = await findIds('posts', { where: { featured: { equals: true } }, sort: '-createdAt', limit: 12, list: 'featured' })
  return res.ids
}

export async function getPost(id: string | number): Promise<Post | null> {
  'use cache'
  return findDocByID('posts', id)
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  'use cache'
  return findDoc('posts', { where: { slug: { equals: slug } }, as: slug })
}

export async function getServiceIds(): Promise<(string | number)[]> {
  'use cache'
  return (await findIds('services', { sort: 'title', limit: 50 })).ids
}

export async function getService(id: string | number): Promise<Service | null> {
  'use cache'
  return findDocByID('services', id)
}

/** The @pro-laico/payload-images integration: the images doc is an ordinary id-keyed
 *  entry — `<ResponsiveImage image={doc} />` renders FROM it, so an alt/focal
 *  edit busts `images:{id}` and exactly this entry re-materializes (with fresh `v=`
 *  tokens in the srcset, so the binary variants re-derive too). The render context
 *  (`{ image, blur }`) declares what's being rendered, so the doc arrives with
 *  `src`/`srcset`/`placeholder` finished for it; 'use cache' keys on the args, one
 *  entry per (id, render). */
export async function getImage(id: string | number, render?: ImageRenderContext): Promise<ResponsiveImageDoc | null> {
  'use cache'
  return findDocByID('images', id, { select: RESPONSIVE_IMAGE_SELECT, context: { ...render } })
}

export async function getImageIds(): Promise<(string | number)[]> {
  'use cache'
  return (await findIds('images', { sort: '-createdAt', limit: 12 })).ids
}

export async function getMedia(id: string | number): Promise<Media | null> {
  'use cache'
  return findDocByID('media', id)
}

export async function getSettings(): Promise<SiteSetting> {
  'use cache'
  return findGlobal('site-settings')
}
