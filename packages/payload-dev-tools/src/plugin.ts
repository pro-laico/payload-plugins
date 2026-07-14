import type { Config, Plugin } from 'payload'

import { createDevEndpoint } from './endpoints/dev'
import type { DevToolsPluginOptions } from './types'
import { createDraftEndpoint } from './endpoints/draft'
import { createStageEndpoint } from './endpoints/stage'
import { createActivateIconSetEndpoint } from './endpoints/activateIconSet'

export function devToolsPlugin(options: DevToolsPluginOptions = {}): Plugin {
  return (config: Config): Config => ({
    ...config,
    custom: { ...config.custom, payloadDevTools: { options, devRoute: options.devRoute ?? '/dev' } },
    endpoints: [
      ...(config.endpoints ?? []),
      createDevEndpoint({ enabled: options.enabled, devRoute: options.devRoute ?? '/dev' }),
      createStageEndpoint({ enabled: options.enabled, devRoute: options.devRoute ?? '/dev' }),
      createDraftEndpoint(options.enabled),
      createActivateIconSetEndpoint(options.enabled),
    ],
  })
}

export default devToolsPlugin
