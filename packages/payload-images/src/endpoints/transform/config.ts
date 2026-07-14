import type { TransformConstraints } from '../../types'
import { DEFAULT_CONSTRAINTS } from '../../lib/transform/params'

export const resolveConstraints = (cfg: Partial<TransformConstraints>): TransformConstraints => {
  const maxDimension = cfg.maxDimension ?? DEFAULT_CONSTRAINTS.maxDimension
  const widthLadder = cfg.widthLadder
    ?.map((w) => Math.round(w))
    .filter((w, i, a) => Number.isFinite(w) && w > 0 && w <= maxDimension && a.indexOf(w) === i)
    .sort((a, b) => a - b)
  return {
    maxDimension,
    qualityRange: cfg.qualityRange ?? DEFAULT_CONSTRAINTS.qualityRange,
    defaultQuality: cfg.defaultQuality ?? DEFAULT_CONSTRAINTS.defaultQuality,
    formats: cfg.formats ?? DEFAULT_CONSTRAINTS.formats,
    defaultFormat: cfg.defaultFormat ?? DEFAULT_CONSTRAINTS.defaultFormat,
    preferAvif: cfg.preferAvif ?? DEFAULT_CONSTRAINTS.preferAvif,
    dimensionStep: cfg.dimensionStep ?? DEFAULT_CONSTRAINTS.dimensionStep,
    maxInputPixels: cfg.maxInputPixels ?? DEFAULT_CONSTRAINTS.maxInputPixels,
    ...(widthLadder?.length ? { widthLadder } : {}),
  }
}
