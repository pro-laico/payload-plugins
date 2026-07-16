import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { createDevEndpoint } from './endpoints/dev'
import { createDraftEndpoint } from './endpoints/draft'
import { createStageEndpoint } from './endpoints/stage'
import { createActivateIconSetEndpoint } from './endpoints/activateIconSet'
import type { DevToolsPluginOptions, PayloadDevToolsMarker } from './types'

export const devToolsPlugin =
  (opts: DevToolsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const { enabled, devRoute } = resolveOptions(opts)
    // Gate at config time rather than per-request: when off, the endpoints don't exist at all
    // instead of registering and 404ing.
    if (!enabled) return config

    const marker: PayloadDevToolsMarker = { options: opts, devRoute }

    return {
      ...config,
      custom: { ...config.custom, payloadDevTools: marker },
      endpoints: [
        ...(config.endpoints ?? []),
        createDevEndpoint({ devRoute }),
        createStageEndpoint({ devRoute }),
        createDraftEndpoint(),
        createActivateIconSetEndpoint(),
      ],
    }
  }

export default devToolsPlugin
