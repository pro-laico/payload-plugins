import type { Config, Plugin } from 'payload'
import { Icon } from './collections/Icon'
import type { IconsPluginOptions } from './types'

/**
 * Adds an `Icon` collection to Payload: SVG-only uploads that are optimized and sanitized on
 * save and stored as an inline `svgString` for the frontend. `iconsPlugin()` with no options is
 * enough; pass {@link IconsPluginOptions} to rename the slug, override access, or extend the
 * collection with extra fields/hooks.
 *
 * @example
 * ```ts
 * import { buildConfig } from 'payload'
 * import { iconsPlugin } from '@pro-laico/payload-icons'
 *
 * export default buildConfig({ plugins: [iconsPlugin()] })
 * ```
 */
export const iconsPlugin =
  (pluginOptions: IconsPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    if (pluginOptions.enabled === false) return incomingConfig
    return { ...incomingConfig, collections: [...(incomingConfig.collections ?? []), Icon(pluginOptions)] }
  }

export default iconsPlugin
