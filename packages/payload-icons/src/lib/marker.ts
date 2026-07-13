import type { SanitizedConfig } from 'payload'

import type { PayloadIconsMarker } from '../types'

/** The plugin's resolved slugs, read off a config that traveled with a live handle.
 *  `undefined` when the plugin isn't applied to that config. */
export const readIconsMarker = (config: SanitizedConfig): PayloadIconsMarker | undefined => {
  const marker = (config.custom as { payloadIcons?: PayloadIconsMarker } | undefined)?.payloadIcons
  return marker && typeof marker === 'object' ? marker : undefined
}

/** The app's icon-set collection slug (honors `iconSetOverrides.slug`); the default when unset. */
export const iconSetSlugOf = (config: SanitizedConfig): string => readIconsMarker(config)?.iconSetSlug ?? 'iconSet'
