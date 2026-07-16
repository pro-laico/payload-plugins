import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { buildSeedRegistry } from './typegen'
import { createSeedEndpoint } from './endpoints/seed'
import type { PayloadSeedMarker, SeedPluginOptions } from './types'

function binScriptPath(name: string): string {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

export const seedPlugin =
  (opts: SeedPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return incomingConfig

    // The seed button and endpoint both no-op unless ENABLE_SEED=true (see guard.ts) — that env var
    // is the real switch, so registering them unconditionally costs nothing and removes the trap of
    // opting into seeding and still getting no button.
    const components = incomingConfig.admin?.components ?? {}
    const marker: PayloadSeedMarker = { options: opts, endpointPath: '/api/seed', assetsDir: resolved.assetsDir }

    const config: Config = {
      ...incomingConfig,
      admin: {
        ...incomingConfig.admin,
        components: { ...components, actions: [...(components.actions ?? []), '@pro-laico/payload-seed/components/SeedButton#SeedButton'] },
      },
      bin: [...(incomingConfig.bin ?? []), { key: 'seed', scriptPath: binScriptPath('seed') }],
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
