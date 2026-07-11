/**
 * beforeDelete on the source → remove its variants FIRST: on SQL adapters the parent delete
 * would otherwise NULL the variants' required `source` FK and trip a NOT NULL constraint.
 * Best-effort and logged: a failed purge must never block the source delete.
 */
import type { CollectionBeforeDeleteHook } from 'payload'

import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import { purgeVariantsForSource } from './purgeVariantsForSource'
import type { PurgeOptions } from '../../types'

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
