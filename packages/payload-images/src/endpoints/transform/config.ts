import { DEFAULT_CONSTRAINTS } from '../../lib/transform/params'
import type { TransformConstraints, TransformEndpointConfig } from '../../types'

/** Fold the endpoint config's optional constraint overrides onto the package defaults. */
export const resolveConstraints = (cfg: TransformEndpointConfig): TransformConstraints => ({
  maxDimension: cfg.maxDimension ?? DEFAULT_CONSTRAINTS.maxDimension,
  qualityRange: cfg.qualityRange ?? DEFAULT_CONSTRAINTS.qualityRange,
  defaultQuality: cfg.defaultQuality ?? DEFAULT_CONSTRAINTS.defaultQuality,
  formats: cfg.formats ?? DEFAULT_CONSTRAINTS.formats,
  defaultFormat: cfg.defaultFormat ?? DEFAULT_CONSTRAINTS.defaultFormat,
  preferAvif: cfg.preferAvif ?? DEFAULT_CONSTRAINTS.preferAvif,
  dimensionStep: cfg.dimensionStep ?? DEFAULT_CONSTRAINTS.dimensionStep,
  maxInputPixels: cfg.maxInputPixels ?? DEFAULT_CONSTRAINTS.maxInputPixels,
})
