import { getPayload, type Payload, type SanitizedConfig } from 'payload'

import type { Awaitable } from '../types'

/** The globalThis slot the plugin's `onInit` fills with the app's sanitized config.
 *  `Symbol.for` → one shared registry entry, so every pro-laico package reads the same
 *  stash without importing each other. */
const CONFIG_SLOT = Symbol.for('pro-laico.payload-config')

/** Called from the plugin's `onInit`: remember the running app's config for the cache helpers. */
export const stashConfig = (config: SanitizedConfig): void => {
  ;(globalThis as Record<symbol, unknown>)[CONFIG_SLOT] = config
}

/** The stashed sanitized config, when Payload has booted in this process (sync — for the
 *  inspection endpoint's lazy graph build; the cache helpers use {@link getConfig}). */
export const peekConfig = (): SanitizedConfig | undefined => (globalThis as Record<symbol, unknown>)[CONFIG_SLOT] as SanitizedConfig | undefined

/**
 * Resolve the host app's Payload config, in order:
 *  1. the globalThis stash the plugin's `onInit` fills the moment Payload boots — covers every
 *     render after init with no bundler involvement, or
 *  2. the `@payload-config` alias `withPayload` sets up — which only resolves from inside a
 *     published package when the consumer transpiles it
 *     (`transpilePackages: ['@pro-laico/payload-revalidate']` in next.config). The `as string`
 *     keeps TS from resolving the alias at this package's own build time.
 */
export const getConfig = async (): Promise<SanitizedConfig> => {
  const stashed = peekConfig()
  if (stashed) return stashed
  try {
    return (await ((
      await import('@payload-config' as string)
    ).default as Awaitable<SanitizedConfig>)) as SanitizedConfig
  } catch {
    throw new Error(
      "[payload-revalidate] could not resolve the app's Payload config: Payload hasn't initialized in this process yet, and the '@payload-config' alias didn't resolve from inside this package. Either add '@pro-laico/payload-revalidate' to `transpilePackages` in next.config (so the host alias applies), or ensure something calls getPayload() before this helper runs.",
    )
  }
}

/** A booted Payload instance, using the host app's config — the shared server-side entry
 *  point for the `./cache` helpers, so the config-resolution trick lives in one place. */
export const getPayloadClient = async (): Promise<Payload> => getPayload({ config: await getConfig() }) //TODO: DELETE THIS. Nothing should be relying on it.
