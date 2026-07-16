import type { SanitizedConfig } from 'payload'

import type { PayloadMuxMarker } from '../types'

export const readMuxMarker = (config: SanitizedConfig | undefined): PayloadMuxMarker | undefined => config?.custom?.payloadMux
