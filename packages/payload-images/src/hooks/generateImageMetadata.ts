/**
 * Upload-time image metadata: when a save carries an actual file (`req.file` — a real
 * upload, never a metadata-only edit), one Sharp decode produces the five blurhash tiers,
 * the color palette, the alpha flags, and a saliency-based focal suggestion — all stored
 * in the same write. `beforeChange`, so there's no second save. Images that predate this
 * hook are covered by `payload images:backfill`.
 *
 * Focal rules (the suggestion must never fight the editor):
 *  - create with a file: applied unless the editor picked a spot (focal absent, or still
 *    the untouched 50/50 default — a dragged point is never exactly 50/50)
 *  - update with a new file: applied only when the doc has no focal at all (a replacement
 *    keeps the editor's chosen focal; they can re-drag)
 */
import type { CollectionBeforeChangeHook } from 'payload'

import { analyzeImageMetadata } from '../blurhash/generate'

const isUnsetFocal = (x: unknown, y: unknown): boolean => (x == null && y == null) || (x === 50 && y === 50)

export const generateImageMetadataBeforeChange = (): CollectionBeforeChangeHook => {
  return async ({ data, req, operation }) => {
    const file = req.file
    if (!file?.data) return data

    try {
      const analysis = await analyzeImageMetadata(file.data)
      const doc = data as Record<string, unknown>
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
