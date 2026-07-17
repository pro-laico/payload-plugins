import type { DevToolsPluginOptions, ResolvedDevToolsOptions } from './types'

export function resolveOptions(options: DevToolsPluginOptions = {}): ResolvedDevToolsOptions {
  return {
    enabled: options.enabled ?? process.env.NODE_ENV === 'development',
    options: { devRoute: options.options?.devRoute ?? '/dev' },
  }
}
