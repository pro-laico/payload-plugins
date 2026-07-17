/** Every field is optional — an omitted one is read from its env var. */
export interface MuxVideoInitSettings {
  /** Mux API token ID. Default: `MUX_TOKEN_ID`. */
  tokenId?: string
  /** Mux API token secret. Default: `MUX_TOKEN_SECRET`. */
  tokenSecret?: string
  /** Verifies incoming webhook signatures. Default: `MUX_WEBHOOK_SECRET`, then `MUX_WEBHOOK_SIGNING_SECRET`. */
  webhookSecret?: string
  /** JWT signing key ID, for signed playback. Default: `MUX_SIGNING_KEY`, then `MUX_JWT_KEY_ID`. */
  jwtSigningKey?: string
  /** JWT private key, for signed playback. Default: `MUX_PRIVATE_KEY`, then `MUX_JWT_KEY`. */
  jwtPrivateKey?: string
}
