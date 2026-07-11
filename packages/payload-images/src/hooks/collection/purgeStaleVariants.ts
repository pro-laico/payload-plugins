/**
 * afterChange on the source → purge stale variants when the file, focal, or hotspot changed
 * (their cache keys are now unreachable). A metadata-only edit leaves variants valid. Best-effort
 * and logged: a failed purge must never block the source write.
 */
import type { CollectionAfterChangeHook } from 'payload'

import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'
import { purgeVariantsForSource } from './purgeVariantsForSource'
import { detectVariantIdentityChange } from './variantIdentity'
import type { PurgeOptions } from '../../types'

export const purgeStaleVariantsAfterChange = (opts: PurgeOptions = {}): CollectionAfterChangeHook => {
  const variantSlug = opts.variantSlug || GENERATED_IMAGES_SLUG
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update') return doc
    if (detectVariantIdentityChange(previousDoc, doc).any) {
      try {
        await purgeVariantsForSource(req.payload, variantSlug, doc.id, req)
      } catch (err) {
        req.payload.logger.warn(`[payload-images] failed to purge stale variants on change of ${doc?.id}: ${String(err)}`)
      }
    }
    return doc
  }
}
