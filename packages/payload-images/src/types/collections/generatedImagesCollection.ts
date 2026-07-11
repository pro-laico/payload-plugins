/** Options for building the hidden generated-images (variant cache) collection. */

export interface CreateGeneratedImagesOptions {
  /** Slug for this collection. Default `generated-images`. */
  slug?: string
  /** Slug of the source image collection the variants point back to. Default `images`. */
  sourceSlug?: string
}
