import type { ArrayField, CollectionConfig, CollectionSlug, Field } from 'payload'

import { authd } from '../access/authd'
import { cleanupFontAssetsHook } from '../hooks/collection/cleanupFontAssets'
import { optimizeFromOriginalsHook } from '../hooks/collection/optimizeFromOriginals'
import { makeRejectSharedOriginals } from '../hooks/collection/rejectSharedOriginals'
import { requireFontFiles } from '../hooks/collection/requireFontFiles'
import { servedFilesHook } from '../hooks/collection/servedFiles'
import { hasVariable, hasWeights } from '../lib/fontDoc'
import { type FontFamilyConfig, resolveFontFamilies } from '../lib/families'
import type { Charset } from '../lib/optimizeFont'
import { FONT_OPTIMIZED_SLUG } from './fontOptimized'
import { FONT_ORIGINAL_SLUG } from './fontOriginal'

/** Standard `next/font/local` weight steps offered by each weight row. */
const WEIGHT_OPTIONS = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

/** Admin component subpath (Payload import map) for the create-only original uploader. */
export const FontOriginalUploadPath = '@pro-laico/payload-fonts/admin/FontOriginalUpload'
/**
 * A FRESH admin config that renders the `fontOriginal` slot create-only (no "Choose from
 * existing"), so every slot uploads a fresh original — never shared between typefaces. A
 * factory (not a shared object) because Payload mutates field configs in place during
 * sanitization; sharing one reference across slots corrupts it.
 */
const createOnlyUpload = () => ({ components: { Field: { path: FontOriginalUploadPath } } })

export interface CreateFontCollectionOptions {
  /** Characters the subsetter keeps, or a preset ('latin' | 'latin-ext'). Default 'latin'. */
  charset?: Charset
  /** Slug of the archival original upload collection. Default 'fontOriginal'. */
  originalSlug?: string
  /** Slug of the optimized (served) upload collection. Default 'fontOptimized'. */
  optimizedSlug?: string
  /** The options offered by the `family` field. Default sans/serif/mono/display. */
  families?: FontFamilyConfig[]
}

/**
 * The `Font` collection — ONE document per **typeface** (e.g. "Inter"). The four family slots
 * (sans/serif/mono/display) select one of these each.
 *
 * It is NOT itself an upload collection. Editors drop font files into standard Payload `upload`
 * fields backed by `fontOriginal` (raw archive) — either the `variable` group (a single
 * variable file per upright/italic) OR the `weights` array (one file per weight/style). On save,
 * {@link optimizeFromOriginalsHook} subsets each referenced original to a served
 * `fontOptimized` WOFF2. The slots are Payload's own upload field, thinly wrapped to be
 * create-only (no "Choose from existing"), so each original belongs to exactly one typeface —
 * keeping asset cleanup safe and race-free.
 */
export const createFontCollection = (opts: CreateFontCollectionOptions = {}): CollectionConfig => {
  const fontSlug = 'font'
  const originalSlug = (opts.originalSlug || FONT_ORIGINAL_SLUG) as CollectionSlug
  const optimizedSlug = opts.optimizedSlug || FONT_OPTIMIZED_SLUG
  const families = resolveFontFamilies(opts.families)

  const fields: Field[] = [
    { name: 'title', type: 'text', required: true, label: 'Typeface name' },
    {
      name: 'family',
      type: 'radio',
      required: true,
      label: 'Preferred Family',
      interfaceName: 'GenericFontFamily',
      options: families.map((r) => ({ label: r.label, value: r.key })),
    },
    // Editor-facing status: how many web-ready files this typeface produced. Virtual (computed on
    // read by `servedFilesHook`, never stored); shown only on an existing doc so a `0` after saving
    // flags a failed/empty optimization instead of it failing silently.
    {
      name: 'servedFiles',
      type: 'number',
      virtual: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Web-ready files generated from your uploads. 0 means nothing was served yet — re-save; if it stays 0, the upload may have failed to optimize (check server logs).',
        condition: (data) => Boolean((data as { id?: unknown })?.id),
      },
    },
    {
      name: 'variable',
      type: 'group',
      label: 'Variable font',
      admin: {
        description: 'One file covering many weights. Use this OR specific weights below — not both.',
        // Hidden once specific weights are added; you compose from one path or the other.
        condition: (data) => !hasWeights(data as Record<string, unknown>),
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
        description: 'One file per weight/style. Add only the weights you need.',
        condition: (data) => !hasVariable(data as Record<string, unknown>),
      },
      // Each weight + style must be unique so the generated next/font src array has no conflicts.
      validate: ((rows: Array<{ weight?: string; style?: string }> | null | undefined) => {
        const seen = new Set<string>()
        for (const r of Array.isArray(rows) ? rows : []) {
          const key = `${r?.weight ?? ''}|${r?.style ?? ''}`
          if (seen.has(key)) return `Two files share weight ${r?.weight ?? '?'} ${r?.style ?? 'normal'}. Each weight + style must be unique.`
          seen.add(key)
        }
        return true
      }) as ArrayField['validate'],
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
      useAsTitle: 'title',
      enableListViewSelectAPI: true,
      defaultColumns: ['title', 'family'],
      description:
        'Upload typefaces here to add them to your library. Uploading alone doesn’t put a font on your site — activate it by picking it in Font Set.',
    },
    timestamps: true,
    // When a font is populated as a relationship target (e.g. the `fontSet` global at depth),
    // return only its identifying metadata and NOT the `variable` / `weights` upload slots — which
    // would otherwise drag the private `fontOriginal` blobs through every populated row.
    defaultPopulate: { title: true, family: true },
    fields,
    hooks: {
      // Guard the referenced originals: at least one file, and no original shared across typefaces.
      beforeValidate: [requireFontFiles, makeRejectSharedOriginals(fontSlug)],
      // On save, (re)build the served WOFF2 files from the referenced originals (and clean up
      // any original a swapped/removed slot de-referenced).
      afterChange: [optimizeFromOriginalsHook({ charset: opts.charset, originalSlug, optimizedSlug })],
      // On read (edit view only), surface the served-file count so a failed optimize isn't silent.
      afterRead: [servedFilesHook(optimizedSlug)],
      // Before delete, cascade to the served files + the archived originals (beforeDelete so the
      // `fontOptimized.font` relationship is still intact — see the hook).
      beforeDelete: [cleanupFontAssetsHook({ originalSlug, optimizedSlug })],
    },
  }
}
