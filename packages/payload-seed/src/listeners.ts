import type { Payload, PayloadRequest } from 'payload'
import type { SeedResult } from './engine/run'

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

const AFTER_SEED_SLOT = Symbol.for('pro-laico.payload-seed.afterSeed')

/** Register (or replace) the listener under `key`. Equivalent to writing the slot directly. */
export const registerAfterSeedListener = (key: string, listener: AfterSeedListener): void => {
  const slot = globalThis as Record<symbol, unknown>
  const listeners = (slot[AFTER_SEED_SLOT] as Record<string, AfterSeedListener> | undefined) ?? {}
  listeners[key] = listener
  slot[AFTER_SEED_SLOT] = listeners
}

/** The currently registered listeners (empty when none). */
export const afterSeedListeners = (): Record<string, AfterSeedListener> =>
  ((globalThis as Record<symbol, unknown>)[AFTER_SEED_SLOT] as Record<string, AfterSeedListener> | undefined) ?? {}

/** Called by the engine after a successful run: invoke every listener, isolating failures. */
export const notifyAfterSeed = async (payload: Payload, req: PayloadRequest, result: SeedResult): Promise<void> => {
  for (const [key, listener] of Object.entries(afterSeedListeners())) {
    try {
      await listener(result, { payload, req })
    } catch (err) {
      payload.logger.warn(`[payload-seed] afterSeed listener '${key}' failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
