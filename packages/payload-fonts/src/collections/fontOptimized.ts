import type { CollectionConfig, CollectionSlug } from 'payload'

import type { CreateFontOptimizedCollectionOptions } from '../types'
import { authd } from '../access'
import { FONT_ORIGINAL_SLUG } from './fontOriginal'

/** Slug of the optimized (served) weight-file upload collection. */
export const FONT_OPTIMIZED_SLUG = 'fontOptimized'

/**
 * The optimized, subsetted WOFF2 files the site actually serves — one upload document per
 * weight/style (or variable file). They are DERIVED, not uploaded by hand: the `Font`
 * collection's save hook reads the referenced `fontOriginal` files, subsets each to WOFF2, and
 * creates one of these linked back to its source original and its owning typeface.
 *
 * Hidden from admin nav (editors only ever touch `Font`), and always server-side stored — the
 * save hook writes the bytes, so there's nothing to client-upload.
 */
export const createFontOptimizedCollection = (opts: CreateFontOptimizedCollectionOptions = {}): CollectionConfig => {
  const fontSlug = opts.fontSlug || 'font'
  const originalSlug = opts.originalSlug || FONT_ORIGINAL_SLUG
  return {
    slug: FONT_OPTIMIZED_SLUG,
    // The optimized files ARE public web fonts — the build-time export endpoint (no user
    // session) downloads them to self-host via next/font. Public read lets that read succeed
    // even when they're on cloud storage served through Payload's access-controlled file route.
    // Writes stay gated; the raw originals stay private.
    access: { create: authd, delete: authd, read: () => true, update: authd },
    // Derived output written by the Font save hook — opt out of @pro-laico/payload-revalidate's
    // auto-attached hooks. Served fonts are consumed at BUILD time (the next/font export
    // endpoint), so runtime cache tags can't refresh them; a rebuild is the invalidation path.
    custom: { revalidate: false },
    admin: {
      group: 'Assets',
      hidden: true,
      enableListViewSelectAPI: true,
      useAsTitle: 'filename',
      defaultColumns: ['filename', 'weight', 'style', 'isVariable'],
    },
    upload: { mimeTypes: ['font/woff2'] },
    fields: [
      // The owning typeface — the export endpoint and the reconcile hook query by it.
      { name: 'font', type: 'relationship', relationTo: fontSlug as CollectionSlug, admin: { readOnly: true } },
      // The source original this was subsetted from — the reconcile key (one optimized per original).
      { name: 'original', type: 'relationship', relationTo: originalSlug as CollectionSlug, admin: { readOnly: true } },
      // CSS font-weight: a single step ('400') or a variable range ('100 900'); served verbatim to next/font.
      { name: 'weight', type: 'text', admin: { readOnly: true } },
      { name: 'style', type: 'radio', options: ['normal', 'italic'], admin: { readOnly: true } },
      { name: 'isVariable', type: 'checkbox', admin: { readOnly: true } },
      // This upright variable file ALSO carries italics via its axes (`ital`, or a negative
      // `slnt`) — the serving layers emit a second, italic @font-face from the same file, unless
      // the typeface has an explicit italic file.
      { name: 'italCapable', type: 'checkbox', admin: { readOnly: true } },
      // For slnt-based italics: the positive CSS `oblique` angle (deg) matching the axis extreme.
      { name: 'obliqueAngle', type: 'number', admin: { readOnly: true, condition: (data) => Boolean(data?.italCapable) } },
    ],
  }
}
