import type { SanitizedConfig } from 'payload'

import type { PayloadImagesMarker } from '../types'

export const readPluginMarker = (config: SanitizedConfig | undefined): PayloadImagesMarker => config?.custom?.payloadImages ?? {}
