import type { CollectionConfig, DateField, NumberField, TextField } from 'payload'

import { authd } from '../_kit'

const d = {
  iconRequestDescription:
    'Icon names requested at runtime that did not resolve to an icon in the active set. Populated unless iconsPlugin({ collections: { iconRequest: false } }) opts out; compare against the IconSet usage panel.',
}

export const ICON_REQUEST_SLUG = 'iconRequest'

const nameField: TextField = { name: 'name', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } }

const countField: NumberField = { name: 'count', type: 'number', defaultValue: 1, admin: { readOnly: true } }

const firstRequestedAtField: DateField = { name: 'firstRequestedAt', type: 'date', admin: { readOnly: true } }

const lastRequestedAtField: DateField = { name: 'lastRequestedAt', type: 'date', admin: { readOnly: true } }

/** The base `iconRequest` collection. `collections.iconRequest` is merged onto it by the kit's `mergeCollection`. */
export const createIconRequestCollection = (): CollectionConfig => ({
  slug: ICON_REQUEST_SLUG,
  access: { create: authd, delete: authd, read: authd, update: authd },
  custom: { revalidate: false },
  admin: {
    group: 'Sets',
    enableListViewSelectAPI: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'count', 'lastRequestedAt'],
    hidden: true,
    description: d.iconRequestDescription,
  },
  fields: [nameField, countField, firstRequestedAtField, lastRequestedAtField],
})
