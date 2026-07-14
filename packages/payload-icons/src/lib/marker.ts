import type { SanitizedConfig } from 'payload'

import type { PayloadIconsMarker } from '../types'
import { isRecord } from './isRecord'

const isIconsMarker = (value: unknown): value is PayloadIconsMarker => isRecord(value) && typeof value.iconSlug === 'string'

export const readIconsMarker = (config: SanitizedConfig): PayloadIconsMarker | undefined => {
  const marker = config.custom?.payloadIcons
  return isIconsMarker(marker) ? marker : undefined
}

export const iconSetSlugOf = (config: SanitizedConfig): string => readIconsMarker(config)?.iconSetSlug ?? 'iconSet'
