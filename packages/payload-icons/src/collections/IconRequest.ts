import type { CollectionConfig } from 'payload'

import { authd } from '../access/authenticated'
import type { IconRequestCollectionOverrides } from '../types'

/** Slug of the runtime icon-request diagnostic collection. */
export const ICON_REQUEST_SLUG = 'iconRequest'

/**
 * Diagnostic collection that records icon names requested at runtime which did
 * NOT resolve to an icon in the active set — the live counterpart to the
 * build-time usage manifest. Populated (throttled, fire-and-forget) by the
 * `<Icon>` server component when `iconsPlugin({ trackRequests: true })` is set,
 * and surfaced in the IconSet "Requested icons" panel.
 *
 * Unlike the static scan, this captures DYNAMIC names (`<Icon name={slug} />`)
 * and genuine production misses — exactly the names a static pass can't see.
 *
 * Rows are written by the recorder via `overrideAccess`; admin access is
 * read/update/delete for authenticated users (it's data you prune, not author).
 */
export const createIconRequestCollection = (opts: IconRequestCollectionOverrides = {}): CollectionConfig => {
  const { group = 'Sets', fields: extraFields = [], hooks } = opts

  return {
    slug: ICON_REQUEST_SLUG,
    access: { create: authd, delete: authd, read: authd, update: authd },
    // Internal diagnostic feed, written at runtime by the miss recorder — opt it out of
    // @pro-laico/payload-revalidate's auto-attached hooks (no frontend read ever caches it).
    custom: { revalidate: false },
    admin: {
      group,
      useAsTitle: 'name',
      defaultColumns: ['name', 'count', 'lastRequestedAt'],
      // Hidden from the sidebar nav — it's a diagnostic feed surfaced through the
      // IconSet "Requested icons" panel (which reads/clears it via the API), not
      // a collection editors browse directly. `hidden` only affects nav/admin
      // visibility; the REST + local API still work, so the panel and recorder
      // are unaffected.
      hidden: true,
      description:
        'Icon names requested at runtime that did not resolve to an icon in the active set. Populated when iconsPlugin({ trackRequests: true }) is set; compare against the IconSet usage panel.',
    },
    fields: [
      { name: 'name', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
      { name: 'count', type: 'number', defaultValue: 1, admin: { readOnly: true } },
      { name: 'firstRequestedAt', type: 'date', admin: { readOnly: true } },
      { name: 'lastRequestedAt', type: 'date', admin: { readOnly: true } },
      ...extraFields,
    ],
    ...(hooks ? { hooks } : {}),
  }
}
