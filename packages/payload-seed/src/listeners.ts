import type { Payload, PayloadRequest } from 'payload'
import type { AfterSeedListener, SeedResult } from './types'

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
