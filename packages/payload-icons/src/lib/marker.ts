import type { SanitizedConfig } from 'payload'

import type { PayloadIconsMarker } from '../types'

export const readIconsMarker = (config: SanitizedConfig | undefined): PayloadIconsMarker | undefined => config?.custom?.payloadIcons

export const iconSetSlugOf = (config: SanitizedConfig): string => readIconsMarker(config)?.iconSetSlug ?? 'iconSet'
