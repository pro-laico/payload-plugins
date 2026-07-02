import { getPayload, type Payload, type SanitizedConfig } from 'payload'

type Awaitable<T> = T | Promise<T>

/** The globalThis slot the plugin's `onInit` fills with the app's sanitized config. `Symbol.for`
 *  → one shared registry entry across every pro-laico package (payload-icons stashes the same
 *  slot), so whichever plugin boots first covers them all. */
const CONFIG_SLOT = Symbol.for('pro-laico.payload-config')

/** Called from the plugin's `onInit`: remember the running app's config for the dev pages. */
export const stashConfig = (config: SanitizedConfig): void => {
  ;(globalThis as Record<symbol, unknown>)[CONFIG_SLOT] = config
}

/**
 * Resolve the host app's Payload config, in order:
 *  1. the globalThis stash filled the moment Payload boots — covers every render after init with
 *     no bundler involvement, or
 *  2. the `@payload-config` alias `withPayload` sets up — which resolves from inside a published
 *     package only when the consumer transpiles it. The `as string` keeps TS from resolving the
 *     alias at this package's own build time.
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
      "[payload-dev-tools] could not resolve the app's Payload config: Payload hasn't initialized in this process yet, and the '@payload-config' alias didn't resolve from inside this package. Either add '@pro-laico/payload-dev-tools' to `transpilePackages` in next.config, or ensure something calls getPayload() before the dev pages render.",
    )
  }
}

/** A booted Payload instance using the host app's config — the server entry for the dev pages. */
export const getPayloadClient = async (): Promise<Payload> => getPayload({ config: await getConfig() })
