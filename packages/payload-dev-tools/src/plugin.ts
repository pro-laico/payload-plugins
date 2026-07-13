import type { Config, Plugin } from 'payload'
import { createActivateIconSetEndpoint } from './endpoints/activateIconSet'
import { createDevEndpoint } from './endpoints/dev'
import { createDraftEndpoint } from './endpoints/draft'
import { createStageEndpoint } from './endpoints/stage'
import type { DevToolsPluginOptions } from './types'

/**
 * The dev-tools plugin. Registers dev-only endpoints (all 404 outside dev):
 *
 * - `GET /api/dev` — the machine-readable app snapshot: environment, detected @pro-laico plugins
 *   with per-plugin panels (seed status, icon misses, font slots, mux readiness), and doc counts
 *   for every collection. Browsers are redirected to the dev pages (`devRoute`).
 * - `GET /api/dev/stage` — sets/clears the test-stage cookie via URL, for scripted staging.
 * - `GET /api/dev/draft` — reports/toggles Next.js draft mode (the toolbar's Draft mode switch).
 * - `POST /api/dev/icons/activate` — switch the active icon set (the `/dev/icons` switcher).
 *
 * Pairs with two frontend pieces from `@pro-laico/payload-dev-tools/toolbar` and `/next`:
 * the floating `<DevToolbar>` (one line in your layout) and `createDevPage` (one catch-all file
 * that serves the `/dev` pages). Both feed themselves — no other wiring.
 *
 *   plugins: [devToolsPlugin()]
 */
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
