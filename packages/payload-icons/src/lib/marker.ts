import type { SanitizedConfig } from 'payload'

import type { PayloadIconsMarker } from '../types'
import { ICON_SET_SLUG } from '../collections/IconSet'

export const readIconsMarker = (config: SanitizedConfig | undefined): PayloadIconsMarker | undefined => config?.custom?.payloadIcons

export const iconSetSlugOf = (config: SanitizedConfig): string => readIconsMarker(config)?.iconSetSlug ?? ICON_SET_SLUG

/** `null` when the collection isn't registered — `collections.iconRequest: false`, or no plugin at all. */
export const iconRequestSlugOf = (config: SanitizedConfig): string | null => readIconsMarker(config)?.iconRequestSlug ?? null
