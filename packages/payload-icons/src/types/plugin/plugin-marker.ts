import type { IconsPluginOptions } from './plugin-options'

/**
 * The `config.custom.payloadIcons` discovery marker — how decoupled tooling
 * (e.g. `@pro-laico/payload-dev-tools`) detects the plugin, and how this package's own
 * server surfaces (the cache resolver, the `<Icon>` factory) read the resolved slugs off
 * the handle the app passes them (`payload.config`). Data-only; written at plugin-apply
 * time.
 */
export interface PayloadIconsMarker {
  options: IconsPluginOptions
  iconSlug: string
  /** The resolved `iconSet` slug (honors `iconSetOverrides.slug`), or `null` when the set collection is disabled. */
  iconSetSlug: string | null
  iconRequestSlug: string | null
}
