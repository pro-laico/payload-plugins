import type { SanitizedConfig } from 'payload'

import type { PayloadImagesMarker } from '../types'

export const readPluginMarker = (config: SanitizedConfig | undefined): PayloadImagesMarker =>
  (config?.custom?.payloadImages as PayloadImagesMarker | undefined) ?? {} //TODO: replace `as` cast with proper typing
