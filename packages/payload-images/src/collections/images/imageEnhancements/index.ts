import type { CollectionConfig, GetAdminThumbnail, JoinField, NumberField, SelectType, UIField } from 'payload'

import { asSlug } from '../../../lib/asSlug'
import { presetsField } from './fields/presets'
import { hotspotFields } from './fields/hotspot'
import type { CreateImagesOptions } from '../../../types'
import { GENERATED_IMAGES_SLUG } from '../../generatedImages'
import { RESPONSIVE_IMAGE_SELECT } from '../../../lib/renderIntent'
import { resolvePresetTemplates } from '../../../lib/presets/defaults'
import { PLACEHOLDER_FIELD_NAMES } from '../../../lib/placeholders/qualities'
import { placeholderField, placeholderStorageFields } from './fields/placeholder'
import { hasAlphaField, isOpaqueField, paletteField } from './fields/mediaMetadata'
import { enqueuePrewarmAfterChange } from '../../../hooks/collection/enqueuePrewarm'
import { generatePresetsAfterChange } from '../../../hooks/collection/generatePresets'
import { purgeVariantsBeforeDelete } from '../../../hooks/collection/purgeVariantsOnDelete'
import { purgeStaleVariantsAfterChange } from '../../../hooks/collection/purgeStaleVariants'
import { generateImageMetadataBeforeChange } from '../../../hooks/collection/generateImageMetadata'
import {
  aspectRatioField,
  placeholderUrlField,
  srcField,
  srcsetField,
  thumbnailUrlField,
  VIRTUAL_URL_INPUTS,
  variantVersionField,
} from './fields/virtualUrls'

const d = {
  variantLimit:
    'Max cached variants for this image before new sizes are served from a nearby existing one instead of being generated + stored. Blank uses the project default. Presets never count against this.',
}

export const FocalPreviewFieldPath = '@pro-laico/payload-images/admin/focalPreview'
export const PresetManagerFieldPath = '@pro-laico/payload-images/admin/presetManager'

export const resolveAdminThumbnail = (adminThumbnail: number | false | undefined, apiRoute = '/api'): GetAdminThumbnail | undefined => {
  if (adminThumbnail === false) return undefined
  // A custom size keeps the dimension URL; the default rides the always-servable `thumbnail`
  // preset template — stable spec, pre-generatable, exempt from the variant cap.
  if (typeof adminThumbnail === 'number') {
    const w = adminThumbnail
    return ({ doc }) => (doc?.id ? `${apiRoute}/img/${String(doc.id)}?w=${w}&h=${w}&fit=cover&fmt=auto` : null)
  }
  return ({ doc }) => (doc?.id ? `${apiRoute}/img/${String(doc.id)}?preset=thumbnail` : null)
}

export const imageEnhancements = (opts: CreateImagesOptions = {}): Partial<CollectionConfig> => {
  const { focalUI = true, previewRatios, purgePath, folders } = opts
  const presetTemplates = resolvePresetTemplates(opts.presetTemplates)
  const variantSlug = asSlug(opts.variantSlug || GENERATED_IMAGES_SLUG)
  const adminThumbnail = resolveAdminThumbnail(opts.adminThumbnail, opts.apiRoute)

  // The admin image-management fields, shown only when `focalUI` is on. Without it the collection
  // is a clean upload and the import map isn't needed.
  const focalPreview: UIField = {
    name: 'focalPreview',
    type: 'ui',
    admin: { components: { Field: { path: FocalPreviewFieldPath, ...(previewRatios ? { clientProps: { previewRatios } } : {}) } } },
  }
  // The preset manager panel owns the whole variant surface: preset table, folded-in variants
  // list, purge button, and the variantLimit input (driven via useField against the hidden field).
  const presetManager: UIField = {
    name: 'presetManager',
    type: 'ui',
    admin: {
      components: {
        Field: {
          path: PresetManagerFieldPath,
          clientProps: {
            templates: presetTemplates,
            variantSlug,
            ...(purgePath ? { purgePath } : {}),
            ...(opts.prewarmPath ? { prewarmPath: opts.prewarmPath } : {}),
            ...(opts.presetsPath ? { presetsPath: opts.presetsPath } : {}),
          },
        },
      },
    },
  }
  const variantLimit: NumberField = {
    name: 'variantLimit',
    type: 'number',
    min: 0,
    ...(opts.variantLimit != null ? { defaultValue: opts.variantLimit } : {}),
    admin: { hidden: true, description: d.variantLimit },
  }
  // Data/API surface only — the panel lists variants itself (paginated REST) so the join never renders.
  const variants: JoinField = {
    name: 'variants',
    type: 'join',
    collection: variantSlug,
    on: 'source',
    admin: { hidden: true, allowCreate: false },
  }
  const adminUIFields = focalUI ? [focalPreview, presetManager, variants] : []

  // A populated image carries exactly what <ResponsiveImage> renders.
  const defaultPopulate: SelectType = RESPONSIVE_IMAGE_SELECT
  // VIRTUAL_URL_INPUTS already includes the hotspot fields; always force the crop/version inputs so
  // the placeholder virtual has them.
  const forceSelect = Object.fromEntries([...VIRTUAL_URL_INPUTS, ...PLACEHOLDER_FIELD_NAMES, 'presets'].map((f): [string, true] => [f, true]))

  const presetGen = opts.presetGen ? generatePresetsAfterChange(opts.presetGen) : null

  return {
    fields: [
      ...adminUIFields,
      aspectRatioField,
      variantVersionField,
      srcField,
      srcsetField,
      placeholderUrlField,
      thumbnailUrlField,
      ...placeholderStorageFields,
      placeholderField,
      paletteField,
      hasAlphaField,
      isOpaqueField,
      ...hotspotFields,
      presetsField(presetTemplates),
      variantLimit,
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
    defaultPopulate,
    forceSelect,
    upload: { focalPoint: true, ...(adminThumbnail ? { adminThumbnail } : {}) },
    ...(folders ? { folders: true } : {}),
  }
}
