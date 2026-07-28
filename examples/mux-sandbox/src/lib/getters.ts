import config from '@payload-config'
import { cacheTag } from 'next/cache'
import { type CollectionSlug, getPayload } from 'payload'
import { getSeedStatus, SANDBOX_TAG } from '@pro-laico/sandbox-shell'

import 'server-only'

// Module scope on purpose: a `'use cache'` entry serializes its arguments AND its closure into the
// cache key, and a Payload instance is a class. A module-scope binding is the one place it can sit.
const db = getPayload({ config })

const SEEDED_SLUGS: CollectionSlug[] = ['mux-video', 'pages']

/** Cached under the sandbox tag, which any write busts — including the webhook-driven `status`
 * updates Mux sends as an upload becomes ready, since those land as ordinary collection writes. */
export const getStatus = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return getSeedStatus(await db, SEEDED_SLUGS)
}

export const getVideos = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return (await (await db).find({ collection: 'mux-video', limit: 50, depth: 0, sort: 'createdAt' })).docs
}
