import type { CollectionConfig } from 'payload'

import { authd } from '../access'

export const IMAGE_RENDER_PROFILES_SLUG = 'image-render-profiles'

const d = {
  profileKey: 'Canonical render shape: ratio|fit|quality|format. One doc per distinct shape the transform endpoint has served.',
  widths: 'Per-width observation histogram: { "640": { n, last } }. Capped; the least-requested widths are evicted.',
  hitCount: 'Approximate total serves (flushed from per-process buffers, throttled).',
}

/**
 * The prewarm registry — one doc per render profile the transform endpoint has actually served
 * (ground truth: browser-chosen widths, real fit/quality/format). Written only by the endpoint's
 * buffered recorder; read by the prewarm job/CLI to decide which variants a new or changed image
 * should get ahead of its first request. Small by construction: the endpoint's snap grid and
 * quality buckets bound the distinct-profile space, and stale profiles stop being warmed (TTL).
 */
export const createRenderProfilesCollection = (opts: { slug?: string } = {}): CollectionConfig => ({
  slug: opts.slug || IMAGE_RENDER_PROFILES_SLUG,
  access: { create: authd, delete: authd, read: authd, update: authd },
  custom: { revalidate: false },
  admin: { hidden: true, group: 'Assets', useAsTitle: 'profileKey', defaultColumns: ['profileKey', 'hitCount', 'lastSeenAt'] },
  fields: [
    { name: 'profileKey', type: 'text', required: true, unique: true, admin: { description: d.profileKey } },
    { name: 'ratio', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'fit', type: 'text', required: true },
        { name: 'quality', type: 'number', required: true },
        { name: 'format', type: 'text', required: true },
      ],
    },
    { name: 'hitCount', type: 'number', defaultValue: 0, admin: { description: d.hitCount } },
    { name: 'lastSeenAt', type: 'date', index: true },
    { name: 'widths', type: 'json', admin: { description: d.widths } },
  ],
})
