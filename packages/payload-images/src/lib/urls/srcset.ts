import { DEFAULT_PIXEL_STEP } from '../transform/params'
import { type BuildUrlOptions, buildVariantUrl } from './variantUrl'

/**
 * The widths for a srcset. A numeric `pixelStep` yields every multiple up to the source's
 * intrinsic width, then the exact source width on top (so the srcset tops out at true native
 * resolution); an array is an explicit non-linear ladder, filtered below the source width with
 * the source width on top. Never exceeds the source (no upscaling) or `maxWidth`.
 */
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

export interface BuildSrcsetOptions extends BuildUrlOptions {
  /** A number = the step increment (default 50); an array = an explicit curated width ladder. */
  pixelStep?: number | number[]
  /** The source image's intrinsic width — caps the srcset (no upscaling). */
  sourceWidth?: number
  /** Hard ceiling. Default 4096. */
  maxWidth?: number
  /** Width used for the plain `src` fallback. Defaults to min(top, 1280). */
  defaultWidth?: number
}

export interface BuildSrcsetResult {
  srcset: string
  src: string
}

/** Build a responsive `srcset` (widths up to the source width) + a default `src`. */
export const buildSrcset = (id: string, o: BuildSrcsetOptions = {}): BuildSrcsetResult => {
  const widths = stepWidths(o.sourceWidth, o.pixelStep, o.maxWidth)
  const srcset = widths.map((w) => `${buildVariantUrl(id, w, o)} ${w}w`).join(', ')
  const top = widths[widths.length - 1] ?? o.maxWidth ?? 4096
  const src = buildVariantUrl(id, o.defaultWidth ?? Math.min(top, 1280), o)
  return { srcset, src }
}
