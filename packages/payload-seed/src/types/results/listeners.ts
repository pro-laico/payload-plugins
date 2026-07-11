import type { Payload, PayloadRequest } from 'payload'
import type { SeedResult } from './seedResult'

/**
 * After-seed listeners: a keyed record on a shared `Symbol.for` globalThis slot, invoked
 * once at the end of every `runSeed` (endpoint AND CLI paths). This is the function-flavored
 * sibling of the `custom.seedAsset` / `custom.seedDisabled` markers — decoupled plugins
 * (e.g. `@pro-laico/payload-revalidate` flushing cache tags for the seeded surface)
 * register under their own key by writing to the slot directly, no import of this package
 * required; the keyed record makes re-registration (HMR) idempotent. Listener failures
 * are logged and never fail the seed.
 */
export type AfterSeedListener = (result: SeedResult, ctx: { payload: Payload; req: PayloadRequest }) => void | Promise<void>
