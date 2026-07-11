import type { CollectionConfig, CollectionSlug, Field, GetAdminThumbnail } from 'payload'

import { RESPONSIVE_IMAGE_SELECT } from '../lib/renderIntent'
import { GENERATED_IMAGES_SLUG } from './generatedImages'
import { PLACEHOLDER_FIELD_NAMES } from '../lib/placeholders/qualities'
import { HOTSPOT_FIELD_NAMES, hotspotFields } from '../fields/hotspot'
import { VIRTUAL_URL_INPUTS, virtualUrlFields } from '../fields/virtualUrls'
import { generateImageMetadataBeforeChange } from '../hooks/collection/generateImageMetadata'
import { blurhashStorageFields, croppedBlurhashField } from '../fields/croppedBlurhash'
import { MEDIA_METADATA_FIELD_NAMES, mediaMetadataFields } from '../fields/mediaMetadata'
import { purgeStaleVariantsAfterChange } from '../hooks/collection/purgeStaleVariants'
import { purgeVariantsBeforeDelete } from '../hooks/collection/purgeVariantsOnDelete'

/** Admin component subpaths (referenced by the Payload import map). */
export const FocalPreviewFieldPath = '@pro-laico/payload-images/admin/focalPreview'
export const PurgeVariantsFieldPath = '@pro-laico/payload-images/admin/purgeVariants'

export interface CreateImagesOptions {
  /** Render the focal-point + ratio-preview field and the purge-variants button. Default true. */
  focalUI?: boolean
  /** Aspect ratios shown in the focal preview tiles. */
  previewRatios?: string[]
  /** Slug of the generated-images collection the `variants` join targets. */
  variantSlug?: string
  /** Purge route (under the API base) the purge button POSTs to. Default `/img/purge`. */
  purgePath?: string
  /** Admin thumbnail width (px), served via the transform endpoint so the admin never loads
   *  full-res originals. Default 160; `false` = Payload's default. */
  adminThumbnail?: number | false
  /** The app's API route base (`config.routes.api`). Default `/api`. */
  apiRoute?: string
  /** Whether the transform + purge endpoints are registered. When false, the UI that targets
   *  them (purge button, `variants` join) is skipped. Default true. */
  endpointsEnabled?: boolean
  /** Add the virtual `src`/`srcset`/`placeholderURL`/`thumbnailURL` fields. Default true. */
  virtualFields?: boolean
  /** Mark the `alt` field `localized: true` (requires Payload localization). Default false. */
  localizeAlt?: boolean
  /** Accepted upload mime types. Defaults to the raster formats the pipeline can transform. */
  mimeTypes?: string[]
  /** Enable Payload's native folder organization on the collection. Default false. */
  folders?: boolean
  /** Cap the *stored* original's longest edge (px) via `upload.resizeOptions`. Off by default. */
  maxOriginalSize?: number
}

/** A focal-cropped admin thumbnail served by the transform endpoint; undefined when disabled. */
const resolveAdminThumbnail = (adminThumbnail: number | false | undefined, apiRoute = '/api'): GetAdminThumbnail | undefined => {
  if (adminThumbnail === false) return undefined
  const w = typeof adminThumbnail === 'number' ? adminThumbnail : 160
  return ({ doc }) => (doc?.id ? `${apiRoute}/img/${String(doc.id)}?w=${w}&h=${w}&fit=cover&fmt=auto` : null)
}

/** The admin image-management fields, shown only when `focalUI` is on. Without it the collection
 *  is a clean upload and the import map isn't needed. */
const adminUIFields = (
  focalUI: boolean,
  variantSlug: CollectionSlug,
  previewRatios?: string[],
  purgePath?: string,
  endpoints = true,
): Field[] =>
  focalUI
    ? [
        {
          name: 'focalPreview',
          type: 'ui',
          admin: { components: { Field: { path: FocalPreviewFieldPath, ...(previewRatios ? { clientProps: { previewRatios } } : {}) } } },
        },
        ...(endpoints
          ? ([
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
            ] as Field[])
          : []),
      ]
    : []

/**
 * The image-pipeline additions as a partial config to deep-merge onto a collection: the admin UI,
 * the purge hooks, `upload.focalPoint`, the on-demand thumbnail, and the lean `defaultPopulate` /
 * `forceSelect` that keep the virtual URLs riding through select/populated reads. Deliberately
 * omits `alt`/`access`/`admin`/`slug` and the mime whitelist so it never clobbers a collection
 * it's merged onto (`extendCollection`).
 */
export const imageEnhancements = (opts: CreateImagesOptions = {}): Partial<CollectionConfig> => {
  const { focalUI = true, virtualFields = true, previewRatios, purgePath, folders, endpointsEnabled = true } = opts
  const variantSlug = (opts.variantSlug || GENERATED_IMAGES_SLUG) as CollectionSlug //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
  const adminThumbnail = resolveAdminThumbnail(opts.adminThumbnail, opts.apiRoute)

  // With the virtuals on, a populated image carries exactly what <ResponsiveImage> renders;
  // without them the component builds URLs itself, so the identity fields ride along instead.
  const defaultPopulate = virtualFields
    ? RESPONSIVE_IMAGE_SELECT
    : {
        alt: true,
        url: true,
        ...Object.fromEntries(MEDIA_METADATA_FIELD_NAMES.map((f) => [f, true])),
        ...Object.fromEntries(HOTSPOT_FIELD_NAMES.map((f) => [f, true])),
      }
  const forceSelect = Object.fromEntries(
    [...(virtualFields ? VIRTUAL_URL_INPUTS : []), ...PLACEHOLDER_FIELD_NAMES, ...HOTSPOT_FIELD_NAMES].map((f) => [f, true]),
  )

  return {
    fields: [
      ...adminUIFields(focalUI, variantSlug, previewRatios, purgePath, endpointsEnabled),
      ...(virtualFields ? virtualUrlFields() : []),
      ...blurhashStorageFields(),
      croppedBlurhashField(),
      ...mediaMetadataFields(),
      ...hotspotFields(),
    ],
    hooks: {
      beforeChange: [generateImageMetadataBeforeChange()],
      afterChange: [purgeStaleVariantsAfterChange({ variantSlug })],
      beforeDelete: [purgeVariantsBeforeDelete({ variantSlug })],
    },
    defaultPopulate: defaultPopulate as CollectionConfig['defaultPopulate'], //EXCUSE: the generated per-collection select type doesn't exist inside the plugin
    ...(forceSelect ? { forceSelect: forceSelect as CollectionConfig['forceSelect'] } : {}), //EXCUSE: same as defaultPopulate above
    upload: { focalPoint: true, ...(adminThumbnail ? { adminThumbnail } : {}) },
    ...(folders ? { folders: true } : {}),
  }
}
