import type { CollectionBeforeDeleteHook } from 'payload'

import type { PurgeOptions } from '../../types'
import { purgeVariantsForSource } from './purgeVariantsForSource'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'

export const purgeVariantsBeforeDelete = (opts: PurgeOptions = {}): CollectionBeforeDeleteHook => {
  const variantSlug = opts.variantSlug || GENERATED_IMAGES_SLUG
  return async ({ id, req }) => {
    try {
      await purgeVariantsForSource(req.payload, variantSlug, id, req)
    } catch (err) {
      req.payload.logger.warn(`[payload-images] failed to purge variants on delete of ${id}: ${String(err)}`)
    }
  }
}
