import { getPayload, type Payload, type SanitizedConfig } from 'payload'

type Awaitable<T> = T | Promise<T>

/**
 * Resolve the host app's Payload config via the `@payload-config` alias that
 * `withPayload` sets up (the standard Next + Payload setup). The `as string`
 * keeps TS from resolving the specifier at this package's build time; swc emits
 * the literal import, so the host bundler's alias still applies.
 */
export const getConfig = async (): Promise<Awaitable<SanitizedConfig>> =>
  (await import('@payload-config' as string)).default as Awaitable<SanitizedConfig>

/** A booted Payload instance, using the host app's aliased config. The shared
 *  server-side entry point for the cache resolvers, the usage panel, and the
 *  runtime miss recorder, so the `@payload-config` alias trick lives in one place. */
export const getPayloadClient = async (): Promise<Payload> => getPayload({ config: await getConfig() })
