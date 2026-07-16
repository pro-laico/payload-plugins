import type { SanitizedConfig } from 'payload'

import type { PayloadSeedMarker } from '../types'

export const readSeedMarker = (config: SanitizedConfig | undefined): PayloadSeedMarker | undefined => config?.custom?.payloadSeed
