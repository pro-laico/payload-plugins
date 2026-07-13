import type { CollectionConfig, GetAdminThumbnail, JoinField, NumberField, UIField } from 'payload'

import { asSlug } from '../../../lib/asSlug'
import { RESPONSIVE_IMAGE_SELECT } from '../../../lib/renderIntent'
import { GENERATED_IMAGES_SLUG } from '../../generatedImages'
import { PLACEHOLDER_FIELD_NAMES } from '../../../lib/placeholders/qualities'
import { hotspotFields } from './fields/hotspot'
import { presetsField } from './fields/presets'
import { placeholderField, placeholderStorageFields } from './fields/placeholder'
import { hasAlphaField, isOpaqueField, paletteField } from './fields/mediaMetadata'
import {
  aspectRatioField,
  placeholderUrlField,
  srcField,
  srcsetField,
  thumbnailUrlField,
  VIRTUAL_URL_INPUTS,
  variantVersionField,
} from './fields/virtualUrls'
import { generateImageMetadataBeforeChange } from '../../../hooks/collection/generateImageMetadata'
import { purgeStaleVariantsAfterChange } from '../../../hooks/collection/purgeStaleVariants'
import { purgeVariantsBeforeDelete } from '../../../hooks/collection/purgeVariantsOnDelete'
import { enqueuePrewarmAfterChange } from '../../../hooks/collection/enqueuePrewarm'
import { generatePresetsAfterChange } from '../../../hooks/collection/generatePresets'
import type { CreateImagesOptions } from '../../../types'

const d = {
  variantLimit:
    'Max cached variants for this image before new sizes are served from a nearby existing one instead of being generated + stored. Blank uses the project default. Presets never count against this.',
}

/** Admin component subpaths (referenced by the Payload import map). */
export const FocalPreviewFieldPath = '@pro-laico/payload-images/admin/focalPreview'
export const PurgeVariantsFieldPath = '@pro-laico/payload-images/admin/purgeVariants'
export const PresetManagerFieldPath = '@pro-laico/payload-images/admin/presetManager'

/** A focal-cropped admin thumbnail served by the transform endpoint; undefined when disabled. */
export const resolveAdminThumbnail = (adminThumbnail: number | false | undefined, apiRoute = '/api'): GetAdminThumbnail | undefined => {
  if (adminThumbnail === false) return undefined
  const w = typeof adminThumbnail === 'number' ? adminThumbnail : 160
  return ({ doc }) => (doc?.id ? `${apiRoute}/img/${String(doc.id)}?w=${w}&h=${w}&fit=cover&fmt=auto` : null)
}

/**
 * The image-pipeline additions as a partial config to deep-merge onto a collection: the admin UI,
 * the purge hooks, `upload.focalPoint`, the on-demand thumbnail, and the lean `defaultPopulate` /
 * `forceSelect` that keep the virtual URLs riding through select/populated reads. Deliberately
 * omits `alt`/`access`/`admin`/`slug` and the mime whitelist so it never clobbers a collection
 * it's merged onto (`extendCollection`). `createImagesCollection` folds it into the managed
 * `images` collection.
 */
export const imageEnhancements = (opts: CreateImagesOptions = {}): Partial<CollectionConfig> => {
  const { focalUI = true, virtualFields = true, previewRatios, purgePath, folders, endpointsEnabled = true, presetTemplates } = opts
  const variantSlug = asSlug(opts.variantSlug || GENERATED_IMAGES_SLUG)
  const adminThumbnail = resolveAdminThumbnail(opts.adminThumbnail, opts.apiRoute)

  // The admin image-management fields, shown only when `focalUI` is on. Without it the collection
  // is a clean upload and the import map isn't needed.
  const focalPreview: UIField = {
    name: 'focalPreview',
    type: 'ui',
    admin: { components: { Field: { path: FocalPreviewFieldPath, ...(previewRatios ? { clientProps: { previewRatios } } : {}) } } },
  }
  const presetManager: UIField = {
    name: 'presetManager',
    type: 'ui',
    admin: { components: { Field: { path: PresetManagerFieldPath, clientProps: { templates: presetTemplates ?? {} } } } },
  }
  const purgeVariants: UIField = {
    name: 'purgeVariants',
    type: 'ui',
    admin: { components: { Field: { path: PurgeVariantsFieldPath, ...(purgePath ? { clientProps: { purgePath } } : {}) } } },
  }
  const variantLimit: NumberField = {
    name: 'variantLimit',
    type: 'number',
    min: 0,
    ...(opts.variantLimit != null ? { defaultValue: opts.variantLimit } : {}),
    admin: { description: d.variantLimit },
  }
  const variants: JoinField = {
    name: 'variants',
    type: 'join',
    collection: variantSlug,
    on: 'source',
    admin: { defaultColumns: ['filename', 'width', 'height', 'format'], allowCreate: false },
  }
  // The limit sits above the variants join it governs when that UI renders; otherwise it's
  // appended after the data fields so it always exists.
  const limitInUI = focalUI && endpointsEnabled
  const adminUIFields = focalUI ? [focalPreview, ...(endpointsEnabled ? [presetManager, purgeVariants, variantLimit, variants] : [])] : []

  // With the virtuals on, a populated image carries exactly what <ResponsiveImage> renders;
  // without them the component builds URLs itself — so the identity fields buildSrcset /
  // getImageUrl / deriveVersion and the placeholder crop need must ride along in EITHER mode.
  const defaultPopulate = virtualFields
    ? RESPONSIVE_IMAGE_SELECT
    : { alt: true, url: true, palette: true, hasAlpha: true, isOpaque: true, ...Object.fromEntries(VIRTUAL_URL_INPUTS.map((f) => [f, true])) }
  // VIRTUAL_URL_INPUTS already includes the hotspot fields; always force the crop/version inputs so
  // the placeholder virtual and the build-URLs-yourself mode have their inputs regardless of virtualFields.
  const forceSelect = Object.fromEntries([...VIRTUAL_URL_INPUTS, ...PLACEHOLDER_FIELD_NAMES, 'presets'].map((f) => [f, true]))

  const presetGen = opts.presetGen && endpointsEnabled ? generatePresetsAfterChange(opts.presetGen) : null

  return {
    fields: [
      ...adminUIFields,
      ...(virtualFields ? [aspectRatioField, variantVersionField, srcField, srcsetField, placeholderUrlField, thumbnailUrlField] : []),
      ...placeholderStorageFields,
      placeholderField,
      paletteField,
      hasAlphaField,
      isOpaqueField,
      ...hotspotFields,
      presetsField(),
      ...(limitInUI ? [] : [variantLimit]),
    ],
    hooks: {
      beforeChange: [generateImageMetadataBeforeChange()],
      // Prewarm enqueues AFTER the purge hook; its 30s waitUntil guarantees purge-before-warm.
      // Preset generation runs after purge too, so file/focal edits regenerate presets with the new crop.
      afterChange: [
        purgeStaleVariantsAfterChange({ variantSlug }),
        ...(opts.prewarm ? [enqueuePrewarmAfterChange(opts.prewarm)] : []),
        ...(presetGen ? [presetGen] : []),
      ],
      beforeDelete: [purgeVariantsBeforeDelete({ variantSlug })],
    },
    defaultPopulate: defaultPopulate as CollectionConfig['defaultPopulate'], //EXCUSE: the generated per-collection select type doesn't exist inside the plugin
    forceSelect: forceSelect as CollectionConfig['forceSelect'], //EXCUSE: same as defaultPopulate above
    upload: { focalPoint: true, ...(adminThumbnail ? { adminThumbnail } : {}) },
    ...(folders ? { folders: true } : {}),
  }
}
