import type { CollectionAfterChangeHook } from 'payload'

import type { PurgeOptions } from '../../types'
import { detectVariantIdentityChange } from './variantIdentity'
import { purgeVariantsForSource } from './purgeVariantsForSource'
import { GENERATED_IMAGES_SLUG } from '../../collections/generatedImages'

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
