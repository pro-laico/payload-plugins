import type { SanitizedConfig } from 'payload'

import type { PayloadDevToolsMarker } from '../types'

export const readDevToolsMarker = (config: SanitizedConfig | undefined): PayloadDevToolsMarker | undefined => config?.custom?.payloadDevTools
