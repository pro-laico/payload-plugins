import type { Payload } from 'payload'

/**
 * Shared toolkit for seed integrations. An "integration" seeds the data of another
 * `@pro-laico/*` plugin (Mux videos, etc.) from local sources, while staying fully decoupled
 * from that plugin: it imports only the relevant third-party SDK (a regular dependency, per
 * Payload's convention) and reads the plugin's credentials/config off `config.custom` by string key — never
 * importing the plugin package. See `mux/` for the reference implementation, and DESIGN.md
 * ("Integrations") for the convention each one follows.
 */

/** The result every integration returns: how many docs it created and how many existing
 *  records/assets it cleared first. */
export interface SeedIntegrationResult {
  created: number
  cleared: number
}

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Poll `fetch` until `done(value)` is true, or `timeoutMs` elapses (returning the last value
 * either way). Integrations use this to wait on an external service becoming ready.
 */
export async function pollUntil<T>(
  fetch: () => Promise<T>,
  done: (value: T) => boolean,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const intervalMs = opts.intervalMs ?? 1000
  const deadline = Date.now() + (opts.timeoutMs ?? 120_000)
  let value = await fetch()
  while (!done(value) && Date.now() < deadline) {
    await delay(intervalMs)
    value = await fetch()
  }
  return value
}

/**
 * Read a plugin's stashed config off `config.custom[key]`. Plugins expose their options here
 * (e.g. `muxVideoPlugin` sets `config.custom.payloadMux`) precisely so tooling can read them
 * by string — keeping integrations decoupled from the plugin packages.
 */
export function readPluginConfig<T>(payload: Payload, key: string): T | undefined {
  return (payload.config.custom as Record<string, T> | undefined)?.[key]
}

/** Consistent log line for integrations. */
export const seedLog = (payload: Payload, message: string): void => payload.logger.info(`[payload-seed] ${message}`)
