import config from '@payload-config'
import { cacheTag } from 'next/cache'
import { type CollectionSlug, getPayload } from 'payload'
import { getSeedStatus, SANDBOX_TAG } from '@pro-laico/sandbox-shell'

import 'server-only'

// The handle lives at module scope, and the getters below reach it from there rather than taking
// it as an argument. A `'use cache'` entry serializes both its arguments and its closure into the
// key, and a Payload instance is a class — module-scope bindings are the one place it can live.
const db = getPayload({ config })

const SEEDED_SLUGS: CollectionSlug[] = ['media', 'services', 'posts']

/** Every read is cached under the sandbox tag, which any write and the end of any seed run busts.
 * That's what lets this page prerender: nothing is read per request, it's read per change. */
export const getStatus = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return getSeedStatus(await db, SEEDED_SLUGS)
}

export const getPosts = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).find({ collection: 'posts', limit: 50, depth: 0, sort: 'createdAt' })).docs
}

export const getMedia = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).find({ collection: 'media', limit: 50, depth: 0, sort: 'createdAt' })).docs
}

export const getServices = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).find({ collection: 'services', limit: 50, depth: 0, sort: 'createdAt' })).docs
}
