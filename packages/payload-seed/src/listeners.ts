import type { Payload, PayloadRequest } from 'payload'

import type { AfterSeedListener, SeedResult } from './types'

const AFTER_SEED_SLOT = Symbol.for('pro-laico.payload-seed.afterSeed')

export const registerAfterSeedListener = (key: string, listener: AfterSeedListener): void => {
  const slot = globalThis as Record<symbol, unknown> //TODO: replace `as` cast with proper typing
  const listeners = (slot[AFTER_SEED_SLOT] as Record<string, AfterSeedListener> | undefined) ?? {} //TODO: replace `as` cast with proper typing
  listeners[key] = listener
  slot[AFTER_SEED_SLOT] = listeners
}

//TODO: replace `as` casts with proper typing
export const afterSeedListeners = (): Record<string, AfterSeedListener> =>
  ((globalThis as Record<symbol, unknown>)[AFTER_SEED_SLOT] as Record<string, AfterSeedListener> | undefined) ?? {}

export const notifyAfterSeed = async (payload: Payload, req: PayloadRequest, result: SeedResult): Promise<void> => {
  for (const [key, listener] of Object.entries(afterSeedListeners())) {
    try {
      await listener(result, { payload, req })
    } catch (err) {
      payload.logger.warn(`[payload-seed] afterSeed listener '${key}' failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
