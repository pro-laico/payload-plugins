import type { CollectionSlug, Payload } from 'payload'

import type { SeedStatus } from './types'

/** Counts docs per slug — feed the app's seeded collection slugs, hand the result to <SeedPanel>. */
export async function getSeedStatus(payload: Payload, slugs: CollectionSlug[]): Promise<SeedStatus> {
  const counts: Record<string, number> = {}
  for (const slug of slugs) {
    counts[slug] = (await payload.count({ collection: slug })).totalDocs
  }
  return { seeded: Object.values(counts).some((n) => n > 0), counts }
}
