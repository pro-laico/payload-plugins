import { getPayload, type Payload, type SanitizedConfig } from 'payload'

import type { Awaitable } from '../types'

/** The globalThis slot the plugin's `onInit` fills with the app's sanitized config.
 *  `Symbol.for` → one shared registry entry, so every pro-laico package reads the same
 *  stash without importing each other. */
const CONFIG_SLOT = Symbol.for('pro-laico.payload-config')

/** Called from the plugin's `onInit`: remember the running app's config for the server components. */
export const stashConfig = (config: SanitizedConfig): void => {
  ;(globalThis as Record<symbol, unknown>)[CONFIG_SLOT] = config
}

/** globalThis slot for the resolved `iconSet` slug, filled when the plugin is APPLIED (config build
 *  time), so it's set in any process that loaded the config — which `getConfig` always does. */
const ICON_SET_SLUG_SLOT = Symbol.for('pro-laico.payload-icons.iconSetSlug')

/** Called from the plugin factory: remember the resolved `iconSet` slug for the cache resolver. */
export const stashIconSetSlug = (slug: string): void => {
  ;(globalThis as Record<symbol, unknown>)[ICON_SET_SLUG_SLOT] = slug
}

/** The app's icon-set collection slug (honors `iconSetOverrides.slug`); the default when unset. */
export const getIconSetSlug = (): string => ((globalThis as Record<symbol, unknown>)[ICON_SET_SLUG_SLOT] as string | undefined) ?? 'iconSet'

/**
 * Resolve the host app's Payload config, in order:
 *  1. the globalThis stash the plugin's `onInit` fills the moment Payload boots — covers every
 *     render after init with no bundler involvement, or
 *  2. the `@payload-config` alias `withPayload` sets up — which only resolves from inside a
 *     published package when the consumer transpiles it
 *     (`transpilePackages: ['@pro-laico/payload-icons']` in next.config). The `as string` keeps
 *     TS from resolving the alias at this package's own build time.
 */
export const getConfig = async (): Promise<SanitizedConfig> => {
  const stashed = (globalThis as Record<symbol, unknown>)[CONFIG_SLOT] as SanitizedConfig | undefined
  if (stashed) return stashed
  try {
    return (await ((
      await import('@payload-config' as string)
    ).default as Awaitable<SanitizedConfig>)) as SanitizedConfig
  } catch {
    throw new Error(
      "[payload-icons] could not resolve the app's Payload config: Payload hasn't initialized in this process yet, and the '@payload-config' alias didn't resolve from inside this package. Either add '@pro-laico/payload-icons' to `transpilePackages` in next.config (so the host alias applies), or ensure something calls getPayload() before this component renders.",
    )
  }
}

/** A booted Payload instance, using the host app's config. The shared server-side entry point
 *  for the cache resolvers, the usage panel, and the runtime miss recorder, so the
 *  config-resolution trick lives in one place. */
export const getPayloadClient = async (): Promise<Payload> => getPayload({ config: await getConfig() })
