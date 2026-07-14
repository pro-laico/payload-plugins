import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { buildSeedRegistry } from './typegen'
import type { SeedPluginOptions } from './types'
import { createSeedEndpoint } from './endpoints/seed'

function binScriptPath(name: string): string {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

export function seedPlugin(options: SeedPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)

  return (incomingConfig: Config): Config => {
    const config: Config = {
      ...incomingConfig,
      bin: [...(incomingConfig.bin ?? []), { key: 'seed', scriptPath: binScriptPath('seed') }],
      custom: { ...incomingConfig.custom, payloadSeed: { options } },
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

    if (resolved.adminButton) {
      const components = config.admin?.components ?? {}
      config.admin = {
        ...config.admin,
        components: { ...components, actions: [...(components.actions ?? []), '@pro-laico/payload-seed/components/SeedButton#SeedButton'] },
      }
    }

    return config
  }
}
