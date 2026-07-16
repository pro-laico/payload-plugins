import type { SanitizedConfig } from 'payload'

import type { PayloadFontsMarker } from '../types'

export const readFontsMarker = (config: SanitizedConfig | undefined): PayloadFontsMarker | undefined => config?.custom?.payloadFonts
