import config from '@payload-config'
import { createImageFor } from '@pro-laico/payload-images'
import { getPayload } from 'payload'

/**
 * The project's Sanity-style image getter, seeded ONCE with this app's Payload handle —
 * `createImageFor` takes the `getPayload` promise as-is (only `fetch()` awaits it):
 *
 *   const img = await imageFor(id).aspectRatio('4:3').blur('md').fetch()
 *   if (img) return <ResponsiveImage {...img} sizes="50vw" />
 *
 * Note this runs the read directly (no 'use cache' / cacheDoc tagging) — the cached,
 * revalidate-tagged variant of the same read is `getImage` in src/lib/data.ts.
 */
export const imageFor = createImageFor(getPayload({ config }))
