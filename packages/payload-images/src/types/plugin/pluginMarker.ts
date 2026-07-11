/** The `custom.payloadImages` marker the plugin stamps onto the config at init. */

export interface PayloadImagesMarker {
  sourceSlug?: string
  variantSlug?: string
  basePath?: string
  pixelStep?: number | number[]
}
