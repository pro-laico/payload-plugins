import type { ArrayField, CollectionConfig, FieldHook, GroupField, NumberField, RadioField, TextField } from 'payload'

import { authd, isRecord } from '../_kit'
import { resolveFontFamilies } from '../lib/families'
import { hasVariable, hasWeights } from '../lib/fontDoc'
import type { CreateFontCollectionOptions } from '../types'
import { servedFilesHook } from '../hooks/collection/servedFiles'
import { requireFontFiles } from '../hooks/collection/requireFontFiles'
import { cleanupFontAssetsHook } from '../hooks/collection/cleanupFontAssets'
import { optimizeFromOriginalsHook } from '../hooks/collection/optimizeFromOriginals'
import { makeRejectSharedOriginals } from '../hooks/collection/rejectSharedOriginals'

const d = {
  servedFiles:
    'Web-ready files generated from your uploads. 0 means nothing was served yet — re-save; if it stays 0, the upload may have failed to optimize (check server logs).',
  variable: 'One file covering many weights. Use this OR specific weights below — not both.',
  weights: 'One file per weight/style. Add only the weights you need.',
  family: 'Which slot this typeface is offered for first in Font Set. Optional — leaving it blank keeps the typeface available for every slot.',
  font: 'Upload typefaces here to add them to your library. Uploading alone doesn’t put a font on your site — activate it by picking it in Font Set.',
}

const WEIGHT_OPTIONS = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

/** The typeface's name with its preferred family appended when it has declared one — `Inter (Sans)`.
 * Every slot in Font Set offers every typeface, so this is what tells an editor which one a typeface
 * was meant for. It backs `useAsTitle`, which is where a relationship select reads its option text.
 *
 * Stored rather than virtual — Payload rejects a virtual `useAsTitle` unless it comes through a
 * relationship. It's written on save and recomputed on read, so a typeface saved before this field
 * existed still labels correctly instead of showing blank until someone re-saves it. `forceSelect`
 * keeps its two inputs present however the document was queried. */
const optionLabelHook =
  (families: { key: string; label: string }[]): FieldHook =>
  ({ data }) => {
    const title = typeof data?.title === 'string' ? data.title : ''
    const key = typeof data?.family === 'string' ? data.family : undefined
    const label = key ? families.find((f) => f.key === key)?.label : undefined
    return label ? `${title} (${label})` : title
  }

export const FontOriginalUploadPath = '@pro-laico/payload-fonts/admin/FontOriginalUpload'
const createOnlyUpload = () => ({ components: { Field: { path: FontOriginalUploadPath } } })

/** The default slug. A `collections.font.slug` override replaces it; `plugin.ts` resolves which and
 * hands the answer to every factory and hook that references this collection. */
export const FONT_SLUG = 'font'

export const createFontCollection = (opts: CreateFontCollectionOptions): CollectionConfig => {
  const { slug: fontSlug, originalSlug, optimizedSlug } = opts
  const families = resolveFontFamilies(opts.families)

  const fields: [TextField, RadioField, TextField, NumberField, GroupField, ArrayField] = [
    { name: 'title', type: 'text', required: true, label: 'Typeface name' },
    {
      name: 'family',
      type: 'radio',
      label: 'Preferred Family',
      admin: { description: d.family },
      interfaceName: 'GenericFontFamily',
      options: families.map((r) => ({ label: r.label, value: r.key })),
    },
    {
      name: 'optionLabel',
      type: 'text',
      admin: { hidden: true, disableListColumn: true },
      hooks: { beforeChange: [optionLabelHook(families)], afterRead: [optionLabelHook(families)] },
    },
    {
      name: 'servedFiles',
      type: 'number',
      virtual: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: d.servedFiles,
        condition: (data) => Boolean(isRecord(data) && data.id),
      },
    },
    {
      name: 'variable',
      type: 'group',
      label: 'Variable font',
      admin: {
        description: d.variable,
        condition: (data) => !hasWeights(isRecord(data) ? data : undefined),
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'upright', type: 'upload', relationTo: originalSlug, label: 'Upright (normal)', admin: createOnlyUpload() },
            { name: 'italic', type: 'upload', relationTo: originalSlug, label: 'Italic', admin: createOnlyUpload() },
          ],
        },
      ],
    },
    {
      name: 'weights',
      type: 'array',
      label: 'Weights',
      labels: { singular: 'Weight file', plural: 'Weight files' },
      admin: {
        description: d.weights,
        condition: (data) => !hasVariable(isRecord(data) ? data : undefined),
      },
      validate: (value) => {
        const seen = new Set<string>()
        for (const r of Array.isArray(value) ? value : []) {
          const weight = isRecord(r) && typeof r.weight === 'string' ? r.weight : ''
          const style = isRecord(r) && typeof r.style === 'string' ? r.style : ''
          const key = `${weight}|${style}`
          if (seen.has(key)) return `Two files share weight ${weight || '?'} ${style || 'normal'}. Each weight + style must be unique.`
          seen.add(key)
        }
        return true
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'weight', type: 'select', required: true, defaultValue: '400', options: WEIGHT_OPTIONS },
            { name: 'style', type: 'radio', required: true, defaultValue: 'normal', options: ['normal', 'italic'] },
          ],
        },
        { name: 'file', type: 'upload', relationTo: originalSlug, required: true, admin: createOnlyUpload() },
      ],
    },
  ]

  return {
    slug: fontSlug,
    access: { create: authd, delete: authd, read: authd, update: authd },
    admin: {
      group: 'Assets',
      useAsTitle: 'optionLabel',
      // Search the name an editor actually typed, not the composed label.
      listSearchableFields: ['title'],
      enableListViewSelectAPI: true,
      defaultColumns: ['title', 'family'],
      description: d.font,
    },
    timestamps: true,
    defaultPopulate: { title: true, family: true, optionLabel: true },
    forceSelect: { title: true, family: true },
    fields,
    hooks: {
      beforeValidate: [requireFontFiles, makeRejectSharedOriginals(fontSlug)],
      afterChange: [optimizeFromOriginalsHook({ charset: opts.charset, originalSlug, optimizedSlug })],
      afterRead: [servedFilesHook(optimizedSlug)],
      beforeDelete: [cleanupFontAssetsHook({ originalSlug, optimizedSlug })],
    },
  }
}
