/** Config for the variant-purge endpoint and the shared purge primitive. */

export interface PurgeEndpointConfig {
  /** Generated-images collection slug. Default `generated-images`. */
  variantSlug?: string
  /** Source image collection slug (purge is authorized against read access to it). Default `images`. */
  sourceSlug?: string
}

export interface PurgeOptions {
  /** Slug of the generated-images collection. Default `generated-images`. */
  variantSlug?: string
}
