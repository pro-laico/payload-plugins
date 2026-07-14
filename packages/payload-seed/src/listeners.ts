import type { Payload, PayloadRequest } from 'payload'

import { isRecord } from './lib/isRecord'
import type { AfterSeedListener, SeedResult } from './types'

const AFTER_SEED_SLOT = Symbol.for('pro-laico.payload-seed.afterSeed')

//EXCUSE: globalThis has no symbol index type; a Symbol.for slot is the decoupled cross-package channel (payload-revalidate registers here without importing us), and a named global would collide across two independently-typed packages
const slot = globalThis as Record<symbol, unknown>

export const registerAfterSeedListener = (key: string, listener: AfterSeedListener): void => {
  const existing = slot[AFTER_SEED_SLOT]
  const listeners = isRecord(existing) ? existing : {}
  listeners[key] = listener
  slot[AFTER_SEED_SLOT] = listeners
}

export const afterSeedListeners = (): Record<string, unknown> => {
  const existing = slot[AFTER_SEED_SLOT]
  return isRecord(existing) ? existing : {}
}

export const notifyAfterSeed = async (payload: Payload, req: PayloadRequest, result: SeedResult): Promise<void> => {
  for (const [key, listener] of Object.entries(afterSeedListeners())) {
    if (typeof listener !== 'function') continue
    try {
      await listener(result, { payload, req })
    } catch (err) {
      payload.logger.warn(`[payload-seed] afterSeed listener '${key}' failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
