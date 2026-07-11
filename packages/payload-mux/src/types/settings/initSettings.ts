/**
 * Mux API credentials + webhook/signing secrets. Every field is optional: anything you don't
 * pass is read from the standard Mux environment variables by the SDK —
 * `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY`,
 * `MUX_PRIVATE_KEY`. Only pass a field to override it (e.g. a non-standard env var name).
 */
export interface MuxVideoInitSettings {
  /** The Mux token ID. @default process.env.MUX_TOKEN_ID */
  tokenId?: string
  /** The Mux token secret. @default process.env.MUX_TOKEN_SECRET */
  tokenSecret?: string
  /** The secret used to verify incoming Mux webhooks. @default process.env.MUX_WEBHOOK_SECRET */
  webhookSecret?: string
  /** JWT signing key ID (signed playback). @default process.env.MUX_SIGNING_KEY */
  jwtSigningKey?: string
  /** JWT private key (signed playback). @default process.env.MUX_PRIVATE_KEY */
  jwtPrivateKey?: string
}
