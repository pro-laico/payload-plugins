import { deriveVersion } from './version'
import { buildVariantUrl } from './variantUrl'
import { DEFAULT_PIXEL_STEP } from '../transform/params'
import type { BuildSrcsetOptions, BuildSrcsetResult, ImageResource } from '../../types'

export const stepWidths = (sourceWidth?: number, pixelStep: number | number[] = DEFAULT_PIXEL_STEP, maxWidth = 4096): number[] => {
  const known = sourceWidth && sourceWidth > 0 ? Math.min(maxWidth, Math.round(sourceWidth)) : undefined

  if (Array.isArray(pixelStep)) {
    const ladder = [
      ...new Set(
        pixelStep
          .filter((w) => Number.isFinite(w) && w > 0)
          .map((w) => Math.round(w))
          .filter((w) => w <= maxWidth),
      ),
    ].sort((a, b) => a - b)
    if (known == null) return ladder.length ? ladder : [maxWidth]
    const widths = ladder.filter((w) => w < known)
    widths.push(known)
    return widths
  }

  const step = pixelStep > 0 ? pixelStep : DEFAULT_PIXEL_STEP
  const top = known ?? maxWidth
  const widths: number[] = []
  for (let w = step; w < top; w += step) widths.push(w)
  widths.push(top)
  return widths
}

export const buildSrcset = (resource: ImageResource, o: BuildSrcsetOptions = {}): BuildSrcsetResult | null => {
  if (resource == null) return null
  const doc = typeof resource === 'object' ? resource : undefined
  const id = doc ? (doc.id == null ? '' : String(doc.id)) : String(resource)
  if (!id) return null
  const opts = { ...o, version: o.version ?? deriveVersion(doc) }
  const widths = stepWidths(doc?.width ?? undefined, o.pixelStep, o.maxWidth)
  const srcset = widths.map((w) => `${buildVariantUrl(id, w, opts)} ${w}w`).join(', ')
  const top = widths[widths.length - 1] ?? o.maxWidth ?? 4096
  const src = buildVariantUrl(id, o.defaultWidth ?? Math.min(top, 1280), opts)
  return { srcset, src }
}
