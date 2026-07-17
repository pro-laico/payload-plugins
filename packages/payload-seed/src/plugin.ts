import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { binScriptPath } from './_kit'
import { buildSeedRegistry } from './typegen'
import { createSeedEndpoint } from './endpoints/seed'
import type { PayloadSeedMarker, SeedPluginOptions } from './types'

/** Declarative, typed seeding: your `defineSeed` exports become one repeatable run. A
 * bootstrap tool for the data a project stands up with — every run is destructive.
 *
 * - `enabled`
 * - `definitions`
 * - `options`
 */
export const seedPlugin =
  (opts: SeedPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return incomingConfig

    // The seed button and endpoint both no-op unless ENABLE_SEED=true (see guard.ts) — that env var
    // is the real switch, so registering them unconditionally costs nothing and removes the trap of
    // opting into seeding and still getting no button.
    const components = incomingConfig.admin?.components ?? {}
    const marker: PayloadSeedMarker = { options: opts, endpointPath: '/api/seed', assetsDir: resolved.options.assetsDir }

    const config: Config = {
      ...incomingConfig,
      admin: {
        ...incomingConfig.admin,
        components: { ...components, actions: [...(components.actions ?? []), '@pro-laico/payload-seed/components/SeedButton#SeedButton'] },
      },
      bin: [...(incomingConfig.bin ?? []), { key: 'seed', scriptPath: binScriptPath(import.meta.url, 'seed') }],
      custom: { ...incomingConfig.custom, payloadSeed: marker },
      endpoints: [...(incomingConfig.endpoints ?? []), createSeedEndpoint(resolved)],
    }

    if (resolved.definitions?.length) {
      const definitions = resolved.definitions
      config.typescript = {
        ...config.typescript,
        postProcess: [
          ...(config.typescript?.postProcess ?? []),
          ({ compiledTypes }) => `${compiledTypes}\n\n${buildSeedRegistry(definitions)}\n`,
        ],
      }
    }

    return config
  }

export default seedPlugin
