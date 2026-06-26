import type { Config, Plugin } from 'payload'
import { createSeedEndpoint } from './endpoint'
import { type SeedPluginOptions, resolveOptions } from './options'

/**
 * The seed plugin. Registers `POST /api/seed` (behind the `ENABLE_SEED` guard +
 * `authorize`), and — when `adminButton` is set — injects the dashboard SeedButton.
 * Seed data lives in auto-discovered `seed.ts` files authored with `defineSeed`.
 *
 *   plugins: [seedPlugin({ assets: { dir: 'assets' }, authorize: (u) => u.role === 'admin' })]
 */
export function seedPlugin(options: SeedPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)

  return (incomingConfig: Config): Config => {
    if (!resolved.enabled) return incomingConfig

    const config: Config = {
      ...incomingConfig,
      endpoints: [...(incomingConfig.endpoints ?? []), createSeedEndpoint(resolved)],
    }

    if (resolved.adminButton) {
      config.admin = {
        ...config.admin,
        components: {
          ...config.admin?.components,
          beforeDashboard: [...(config.admin?.components?.beforeDashboard ?? []), '@pro-laico/payload-seed/components/SeedButton#SeedButton'],
        },
      }
    }

    return config
  }
}
