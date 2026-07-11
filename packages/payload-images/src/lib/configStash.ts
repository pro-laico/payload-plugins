import type { SanitizedConfig } from 'payload'

/** `Symbol.for` → one shared registry entry, so every pro-laico package reads the same stash
 *  without importing each other. This package only WRITES it; siblings (payload-revalidate,
 *  payload-dev-tools, payload-icons) read the slot. */
const CONFIG_SLOT = Symbol.for('pro-laico.payload-config')

/** Called from the plugin's `onInit`: publish the running app's config to the shared slot. */
export const stashConfig = (config: SanitizedConfig): void => {
  ;(globalThis as Record<symbol, unknown>)[CONFIG_SLOT] = config
}
