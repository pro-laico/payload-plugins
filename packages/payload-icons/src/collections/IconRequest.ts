import type { CollectionConfig } from 'payload'

import { authd } from '../access/authenticated'
import type { IconRequestCollectionOverrides } from '../types'

const d = {
  iconRequestDescription:
    'Icon names requested at runtime that did not resolve to an icon in the active set. Populated when iconsPlugin({ trackRequests: true }) is set; compare against the IconSet usage panel.',
}

export const ICON_REQUEST_SLUG = 'iconRequest'

export const createIconRequestCollection = (opts: IconRequestCollectionOverrides = {}): CollectionConfig => {
  const { group = 'Sets', fields: extraFields = [], hooks } = opts

  return {
    slug: ICON_REQUEST_SLUG,
    access: { create: authd, delete: authd, read: authd, update: authd },
    custom: { revalidate: false },
    admin: {
      group,
      enableListViewSelectAPI: true,
      useAsTitle: 'name',
      defaultColumns: ['name', 'count', 'lastRequestedAt'],
      hidden: true,
      description: d.iconRequestDescription,
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
