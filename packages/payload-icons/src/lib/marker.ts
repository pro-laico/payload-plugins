import type { SanitizedConfig } from 'payload'

import type { PayloadIconsMarker } from '../types'

export const readIconsMarker = (config: SanitizedConfig): PayloadIconsMarker | undefined => {
  //TODO: replace `as` cast with proper typing
  const marker = (config.custom as { payloadIcons?: PayloadIconsMarker } | undefined)?.payloadIcons
  return marker && typeof marker === 'object' ? marker : undefined
}

export const iconSetSlugOf = (config: SanitizedConfig): string => readIconsMarker(config)?.iconSetSlug ?? 'iconSet'
