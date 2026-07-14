import type { CollectionBeforeChangeHook } from 'payload'

import { analyzeImageMetadata } from '../../lib/metadata/analyze'
import { isRecord } from '../../lib/isRecord'

const isUnsetFocal = (x: unknown, y: unknown): boolean => (x == null && y == null) || (x === 50 && y === 50)

export const generateImageMetadataBeforeChange = (): CollectionBeforeChangeHook => {
  return async ({ data, req, operation }) => {
    const file = req.file
    if (!file?.data) return data

    try {
      const analysis = await analyzeImageMetadata(file.data)
      if (!isRecord(data)) return data
      const doc = data
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
