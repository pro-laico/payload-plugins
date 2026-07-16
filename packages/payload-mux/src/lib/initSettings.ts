import type { MuxVideoInitSettings } from '../types'

/** Env var aliases, in precedence order: the Mux SDK's own name first, then the name the
 * Oversight Studio mux-video plugin's README wires up — so a project migrating from it keeps
 * working without renaming anything in its host. `tokenId` / `tokenSecret` share a name in both. */
const ALIASES = {
  tokenId: ['MUX_TOKEN_ID'],
  tokenSecret: ['MUX_TOKEN_SECRET'],
  webhookSecret: ['MUX_WEBHOOK_SECRET', 'MUX_WEBHOOK_SIGNING_SECRET'],
  jwtSigningKey: ['MUX_SIGNING_KEY', 'MUX_JWT_KEY_ID'],
  jwtPrivateKey: ['MUX_PRIVATE_KEY', 'MUX_JWT_KEY'],
} as const satisfies Record<keyof MuxVideoInitSettings, readonly string[]>

const fromEnv = (names: readonly string[]): string | undefined => names.map((name) => process.env[name]).find(Boolean)

/** Explicit `initSettings` win, then env. Undefined fields are left for the SDK's own env
 * defaults, so passing this to `new Mux()` never widens what the SDK would have read. */
export const resolveInitSettings = (initSettings?: MuxVideoInitSettings): MuxVideoInitSettings => ({
  tokenId: initSettings?.tokenId ?? fromEnv(ALIASES.tokenId),
  tokenSecret: initSettings?.tokenSecret ?? fromEnv(ALIASES.tokenSecret),
  webhookSecret: initSettings?.webhookSecret ?? fromEnv(ALIASES.webhookSecret),
  jwtSigningKey: initSettings?.jwtSigningKey ?? fromEnv(ALIASES.jwtSigningKey),
  jwtPrivateKey: initSettings?.jwtPrivateKey ?? fromEnv(ALIASES.jwtPrivateKey),
})
