import type { SanitizedConfig } from 'payload'

import type { PayloadImagesMarker } from '../types'

/** Read the plugin marker off a config. The plugin is the marker's only writer, so the shape is trusted. */
export const readPluginMarker = (config: SanitizedConfig | undefined): PayloadImagesMarker =>
  (config?.custom?.payloadImages as PayloadImagesMarker | undefined) ?? {} //EXCUSE: single-writer marker — the plugin stamps this exact shape at init
