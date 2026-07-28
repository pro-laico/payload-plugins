import config from '@payload-config'
import { cacheTag } from 'next/cache'
import { type CollectionSlug, getPayload } from 'payload'
import { getSeedStatus, SANDBOX_TAG } from '@pro-laico/sandbox-shell'

import 'server-only'

// Module scope on purpose: a `'use cache'` entry serializes its arguments AND its closure into the
// cache key, and a Payload instance is a class. A module-scope binding is the one place it can sit.
const db = getPayload({ config })

const SEEDED_SLUGS: CollectionSlug[] = ['images', 'pages']

/** Cached under the sandbox tag, which any write and the end of any seed run busts — so these pages
 * prerender instead of re-querying per request. Note what is NOT cached by this: the variants
 * `/api/img/:id` generates on demand, which is the endpoint's own concern. */
export const getStatus = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return getSeedStatus(await db, SEEDED_SLUGS)
}

export const getImages = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  const res = await (await db).find({
    collection: 'images',
    limit: 50,
    depth: 0,
    sort: 'createdAt',
    select: { alt: true, width: true, height: true, focalX: true, focalY: true },
  })
  return res.docs
}

export const getPages = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).find({ collection: 'pages', limit: 10, depth: 0, sort: 'createdAt' })).docs
}

export const getImageCount = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).count({ collection: 'images' })).totalDocs
}

export const getFirstImage = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).find({ collection: 'images', limit: 1, depth: 0, sort: 'createdAt' })).docs.at(0)
}
