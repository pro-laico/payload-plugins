import type { CollectionSlug, Payload } from 'payload'

import type { SeedStatus } from './types'

/** Counts docs per slug — feed the app's seeded collection slugs, hand the result to <SeedPanel>. */
export async function getSeedStatus(payload: Payload, slugs: string[]): Promise<SeedStatus> {
  const counts: Record<string, number> = {}
  for (const slug of slugs) {
    //TODO: replace `as` cast with proper typing
    counts[slug] = (await payload.count({ collection: slug as CollectionSlug })).totalDocs
  }
  return { seeded: Object.values(counts).some((n) => n > 0), counts }
}
