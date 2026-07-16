import type { SanitizedConfig } from 'payload'

import type { PayloadImagesMarker } from '../types'

export const readImagesMarker = (config: SanitizedConfig | undefined): PayloadImagesMarker | undefined => config?.custom?.payloadImages
