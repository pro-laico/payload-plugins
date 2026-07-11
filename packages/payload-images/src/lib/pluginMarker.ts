import type { SanitizedConfig } from 'payload'

/** The `custom.payloadImages` marker the plugin stamps onto the config at init. */
export interface PayloadImagesMarker {
  sourceSlug?: string
  variantSlug?: string
  basePath?: string
  pixelStep?: number | number[]
}

/** Read the plugin marker off a config. The plugin is the marker's only writer, so the shape is trusted. */
export const readPluginMarker = (config: SanitizedConfig | undefined): PayloadImagesMarker =>
  (config?.custom?.payloadImages as PayloadImagesMarker | undefined) ?? {} //EXCUSE: single-writer marker — the plugin stamps this exact shape at init
