import type { CollectionConfig, CollectionSlug, Field, GetAdminThumbnail, ImageSize, ImageUploadFormatOptions } from 'payload'

import { anyone, authd } from '../access'
import { VIRTUAL_URL_FIELDS, VIRTUAL_URL_INPUTS, virtualUrlFields } from '../fields/virtualUrls'
import { purgeStaleVariantsAfterChange, purgeVariantsBeforeDelete } from '../hooks/purge'
import { IMAGE_MIME_TYPES } from '../transform/params'
import { GENERATED_IMAGES_SLUG } from './generatedImages'

const formatOptions: ImageUploadFormatOptions = { format: 'webp', options: { nearLossless: true, quality: 75 } }

/** Admin component subpaths (referenced by the Payload import map). */
export const FocalPreviewFieldPath = '@pro-laico/payload-images/admin/focalPreview'
export const PurgeVariantsFieldPath = '@pro-laico/payload-images/admin/purgeVariants'

/** Built-in size ladder used when `pregenerateSizes: true` — Payload's classic on-upload sizes. */
const DEFAULT_SIZE_LADDER: ImageSize[] = [
  { formatOptions, name: 'thumbnail', width: 300 },
  { formatOptions, name: 'square', width: 500, height: 500 },
  { formatOptions, name: 'small', width: 600 },
  { formatOptions, name: 'medium', width: 900 },
  { formatOptions, name: 'large', width: 1400 },
  { formatOptions, name: 'xlarge', width: 1920 },
  { formatOptions, name: 'og', width: 1200, height: 630, crop: 'center' },
]

export interface CreateImagesOptions {
  /** Opt into Payload's classic on-upload size ladder instead of on-demand transforms. Off by
   *  default (uploads store only the original; every size is generated on demand). `true` uses a
   *  built-in 7-size ladder; pass an array for a custom one. */
  pregenerateSizes?: boolean | ImageSize[]
  /** Render the focal-point + ratio-preview field and the purge-variants button. Default true. */
  focalUI?: boolean
  /** Aspect ratios shown in the focal preview tiles. */
  previewRatios?: string[]
  /** Slug of the generated-images collection the `variants` join targets. */
  variantSlug?: string
  /** Purge route (under the API base) the purge button POSTs to. Default `/img/purge`. */
  purgePath?: string
  /** Admin list/preview thumbnail width (px), served on-demand via `/api/img` so the admin
   *  never loads full-res originals. Default 160; pass `false` to use Payload's default. */
  adminThumbnail?: number | false
  /** Add virtual `src`/`srcset`/`placeholderURL`/`thumbnailURL` fields (computed on read), so
   *  optimized URLs ride along in every REST/GraphQL/Local-API response. Default true. */
  virtualFields?: boolean
  /** Mark the `alt` field `localized: true` (requires Payload localization). Default false. */
  localizeAlt?: boolean
}

/**
 * A focal-cropped admin thumbnail served by the transform endpoint, so the Images list view
 * loads tiny WebP thumbnails instead of full-resolution originals. Returns `undefined` when
 * disabled (`adminThumbnail: false`, or the transform endpoint isn't registered). Assumes the
 * default `/api/img` route — override via `imagesOptions.upload.adminThumbnail` for a custom
 * `routes.api`.
 */
const resolveAdminThumbnail = (adminThumbnail: number | false | undefined): GetAdminThumbnail | undefined => {
  if (adminThumbnail === false) return undefined
  const w = typeof adminThumbnail === 'number' ? adminThumbnail : 160
  return ({ doc }) => (doc?.id ? `/api/img/${String(doc.id)}?w=${w}&h=${w}&fit=cover&fmt=auto` : null)
}

/**
 * The admin "image management" fields, shown only when `focalUI` is on: the focal-point picker,
 * the ratio preview, the purge-variants button, and the `variants` join listing the cached
 * variants (it pairs with the purge button). With `focalUI: false` the collection is a clean
 * upload — just `alt` + the file — and the import map isn't needed.
 */
const adminUIFields = (focalUI: boolean, variantSlug: CollectionSlug, previewRatios?: string[], purgePath?: string): Field[] =>
  focalUI
    ? [
        {
          name: 'focalPreview',
          type: 'ui',
          admin: { components: { Field: { path: FocalPreviewFieldPath, ...(previewRatios ? { clientProps: { previewRatios } } : {}) } } },
        },
        {
          name: 'purgeVariants',
          type: 'ui',
          admin: { components: { Field: { path: PurgeVariantsFieldPath, ...(purgePath ? { clientProps: { purgePath } } : {}) } } },
        },
        {
          name: 'variants',
          type: 'join',
          collection: variantSlug,
          on: 'source',
          admin: { defaultColumns: ['filename', 'width', 'height', 'format'], allowCreate: false },
        },
      ]
    : []

/**
 * The image-pipeline additions, as a partial config to deep-merge onto a collection: the admin
 * image-management UI (gated by `focalUI`), the purge hooks, and `upload.focalPoint`. The factory
 * below folds these into the default `images` collection; the plugin folds them onto an existing
 * collection when `extendCollection` is set (so a project's own `media` collection gains the
 * pipeline without a second collection). Deliberately omits `alt`/`access`/`admin`/`slug` and the
 * mime whitelist so it never clobbers a collection it's merged onto.
 */
export const imageEnhancements = (opts: CreateImagesOptions = {}): Partial<CollectionConfig> => {
  const { focalUI = true, virtualFields = true, previewRatios, purgePath } = opts
  const variantSlug = (opts.variantSlug || GENERATED_IMAGES_SLUG) as CollectionSlug
  return {
    // Admin UI is gated by focalUI; the virtual URL fields are for API consumers, so they're
    // added independently (hidden in the admin).
    fields: [...adminUIFields(focalUI, variantSlug, previewRatios, purgePath), ...(virtualFields ? virtualUrlFields() : [])],
    hooks: {
      afterChange: [purgeStaleVariantsAfterChange({ variantSlug })],
      beforeDelete: [purgeVariantsBeforeDelete({ variantSlug })],
    },
    upload: { focalPoint: true },
  }
}

/**
 * The source image upload collection. Stores only the original (no pre-generated sizes by
 * default); keeps Payload's built-in `focalPoint` (the focal component enhances it). The
 * on-demand transform endpoint serves every rendered variant and records it in the
 * generated-images collection, surfaced here via the `variants` join and purged by the
 * change/delete hooks. The LQIP placeholder is derived on the frontend from the smallest
 * transform variant — there's no stored placeholder field.
 */
export const createImagesCollection = (opts: CreateImagesOptions = {}): CollectionConfig => {
  const { pregenerateSizes = false, virtualFields = true, localizeAlt = false } = opts
  const imageSizes = pregenerateSizes === true ? DEFAULT_SIZE_LADDER : Array.isArray(pregenerateSizes) ? pregenerateSizes : undefined
  const adminThumbnail = resolveAdminThumbnail(opts.adminThumbnail)
  const enh = imageEnhancements(opts)

  // Lean relationship population: when an image is referenced (e.g. `page.heroImage`), populate the
  // renderable fields + the virtual URLs, and skip the `variants` join (which would run an extra
  // query per populated image). `forceSelect` keeps the virtual fields' inputs present under `select`.
  const renderableFields = { alt: true, url: true, filename: true, width: true, height: true, focalX: true, focalY: true }
  const defaultPopulate = virtualFields
    ? { ...renderableFields, ...Object.fromEntries(VIRTUAL_URL_FIELDS.map((f) => [f, true])) }
    : renderableFields
  const forceSelect = virtualFields ? Object.fromEntries(VIRTUAL_URL_INPUTS.map((f) => [f, true])) : undefined

  return {
    slug: 'images',
    access: { create: authd, delete: authd, read: anyone, update: authd },
    admin: {
      group: 'Assets',
      description: 'Upload images here. Display sizes are generated on demand and cached — store the original once, render any size.',
      enableListViewSelectAPI: true,
      useAsTitle: 'alt',
      defaultColumns: ['alt', 'updatedAt'],
      listSearchableFields: ['alt'],
    },
    defaultPopulate: defaultPopulate as CollectionConfig['defaultPopulate'],
    ...(forceSelect ? { forceSelect: forceSelect as CollectionConfig['forceSelect'] } : {}),
    fields: [
      {
        name: 'alt',
        type: 'text',
        required: true,
        localized: localizeAlt,
        admin: { description: 'Describe the image for screen readers and SEO.' },
      },
      ...(enh.fields ?? []),
    ],
    hooks: enh.hooks,
    upload: {
      focalPoint: true,
      displayPreview: true, // show image thumbnails in upload/relationship fields that target this collection
      mimeTypes: IMAGE_MIME_TYPES,
      ...(adminThumbnail ? { adminThumbnail } : {}),
      ...(imageSizes ? { imageSizes } : {}),
    },
  }
}

/** The default Images collection (on-demand transforms, no pre-generated sizes). */
export const Images: CollectionConfig = createImagesCollection()
