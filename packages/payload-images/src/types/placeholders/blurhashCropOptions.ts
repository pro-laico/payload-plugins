/** Option bags for the BlurHash grid encode and the two crop strategies. */

export interface EncodeGridOptions {
  /**
   * Use true orthogonal norms (1 / 2 / 4) instead of wolt's flat 2-for-every-AC. Wolt's norm
   * halves the both-axes AC terms on any decode→re-encode round trip — set this when the input
   * grid is itself a decoded blurhash, so the round trip is lossless. Default false (stock).
   */
  orthonormal?: boolean
}

export interface CropResampleOptions {
  /** Output components. Default: same as the source hash. */
  cx?: number
  cy?: number
  /** Sample grid for the round-trip. Default 32 — plenty above Nyquist for ≤9 components. */
  samples?: number
  /** Stock wolt encode norms instead of round-trip-exact orthogonal ones. Default false. */
  stockNorms?: boolean
}

export interface CropCoefficientsOptions {
  /** Output components. Default: same as the source hash. */
  cx?: number
  cy?: number
}
