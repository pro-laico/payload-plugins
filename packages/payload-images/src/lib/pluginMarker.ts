import type { SanitizedConfig } from 'payload'

/** The `custom.payloadImages` marker the plugin stamps onto the config at init —
 *  the fields consumers outside the plugin closure need to read back. */
export interface PayloadImagesMarker {
  sourceSlug?: string
  variantSlug?: string
  basePath?: string
  pixelStep?: number | number[]
}

const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number')

/**
 * Read the plugin marker off a (possibly foreign) config, field-validating every value —
 * `custom` is an untyped bag, so nothing is trusted. Missing/malformed fields are simply
 * absent from the result.
 */
export const readPluginMarker = (config: SanitizedConfig | undefined): PayloadImagesMarker => {
  const m: unknown = config?.custom?.payloadImages
  if (typeof m !== 'object' || m === null) return {}
  const out: PayloadImagesMarker = {}
  if ('sourceSlug' in m && typeof m.sourceSlug === 'string') out.sourceSlug = m.sourceSlug
  if ('variantSlug' in m && typeof m.variantSlug === 'string') out.variantSlug = m.variantSlug
  if ('basePath' in m && typeof m.basePath === 'string') out.basePath = m.basePath
  if ('pixelStep' in m && (typeof m.pixelStep === 'number' || isNumberArray(m.pixelStep))) out.pixelStep = m.pixelStep
  return out
}
