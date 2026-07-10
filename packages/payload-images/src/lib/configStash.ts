import type { SanitizedConfig } from 'payload'

/** The globalThis slot the plugin's `onInit` fills with the app's sanitized config.
 *  `Symbol.for` → one shared registry entry, so every pro-laico package reads the same
 *  stash without importing each other. Config only — the render path is pure (the
 *  placeholder is a blurhash string already on the doc), so no instance is ever needed
 *  outside a request, and this package never calls `getPayload`. */
const CONFIG_SLOT = Symbol.for('pro-laico.payload-config')

/** Called from the plugin's `onInit`: remember the running app's config for the server components. */
export const stashConfig = (config: SanitizedConfig): void => {
  ;(globalThis as Record<symbol, unknown>)[CONFIG_SLOT] = config
}

/** The stashed config, once Payload has booted in this process (undefined before). */
export const stashedConfig = (): SanitizedConfig | undefined =>
  (globalThis as Record<symbol, unknown>)[CONFIG_SLOT] as SanitizedConfig | undefined
