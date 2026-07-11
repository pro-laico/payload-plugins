/**
 * Upload-time metadata: when a save carries an actual file (`req.file` — never a metadata-only
 * edit), one Sharp decode stores the placeholder tiers, palette, alpha flags, and a saliency
 * focal suggestion in the same write. The suggestion never fights the editor: on create it
 * applies unless a spot was picked (a dragged point is never exactly 50/50); on update it
 * applies only when the doc has no focal at all.
 */
import type { CollectionBeforeChangeHook } from 'payload'

import { analyzeImageMetadata } from '../../lib/metadata/analyze'

const isUnsetFocal = (x: unknown, y: unknown): boolean => (x == null && y == null) || (x === 50 && y === 50)

export const generateImageMetadataBeforeChange = (): CollectionBeforeChangeHook => {
  return async ({ data, req, operation }) => {
    const file = req.file
    if (!file?.data) return data

    try {
      const analysis = await analyzeImageMetadata(file.data)
      const doc = data as Record<string, unknown> //EXCUSE: hook data for a runtime-configured collection is untyped
      Object.assign(doc, analysis.placeholderFields)
      doc.palette = analysis.palette
      doc.hasAlpha = analysis.hasAlpha
      doc.isOpaque = analysis.isOpaque

      if (analysis.attention && (operation === 'create' ? isUnsetFocal(doc.focalX, doc.focalY) : doc.focalX == null && doc.focalY == null)) {
        doc.focalX = analysis.attention.x
        doc.focalY = analysis.attention.y
      }
    } catch (err) {
      req.payload.logger.warn(`[payload-images] image metadata generation failed for '${String(file.name)}': ${String(err)}`)
    }
    return data
  }
}
