import { DEFAULT_REGIONS } from './lib/regions'
import { devEnabled } from './lib/devEnabled'
import type { DevToolsPluginOptions, ResolvedDevToolsOptions } from './types'

export function resolveOptions(options: DevToolsPluginOptions = {}): ResolvedDevToolsOptions {
  return {
    enabled: devEnabled(options.enabled),
    options: {
      devRoute: options.options?.devRoute ?? '/dev',
      regions: options.options?.regions ?? DEFAULT_REGIONS,
      access: { dev: options.options?.access?.dev },
    },
  }
}
