import config from '@payload-config'
import { cacheTag } from 'next/cache'
import { type CollectionSlug, getPayload } from 'payload'
import { getActiveFontFaces } from '@pro-laico/payload-fonts'
import { getSeedStatus, SANDBOX_TAG } from '@pro-laico/sandbox-shell'

import type { ActiveEntry } from '@/types'

import 'server-only'

// Module scope on purpose: a `'use cache'` entry serializes its arguments AND its closure into the
// cache key, and a Payload instance is a class. A module-scope binding is the one place it can sit.
const db = getPayload({ config })

const SEEDED_SLUGS: CollectionSlug[] = ['fontOriginal', 'font']

/** Cached under the sandbox tag, which any write and the end of any seed run busts — so this page
 * prerenders instead of re-querying per request. */
export const getStatus = async () => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  return getSeedStatus(await db, SEEDED_SLUGS)
}

/** The active typefaces (family, title, served faces) — the fonts the layout makes available as
 *  `--font-set*` variables (this playground uses the live `<PreviewFonts />` path). */
export const getActive = async (): Promise<ActiveEntry[]> => {
  'use cache'
  cacheTag(SANDBOX_TAG)
  const payload = await db
  const faces = await getActiveFontFaces(payload)

  const titleByFamily = new Map<string, string>()
  try {
    const fontSet = await payload.findGlobal({ slug: 'fontSet', depth: 1 })
    const familyDocs = { sans: fontSet.sans, serif: fontSet.serif, mono: fontSet.mono, display: fontSet.display }
    for (const [family, doc] of Object.entries(familyDocs)) {
      if (doc && typeof doc === 'object' && doc.title) titleByFamily.set(family, doc.title)
    }
  } catch {}

  return faces.map((f) => ({ family: f.family, title: titleByFamily.get(f.family) ?? f.family, faces: f.faces }))
}
