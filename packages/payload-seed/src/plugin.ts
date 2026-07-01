import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config, Plugin } from 'payload'
import { createSeedEndpoint } from './endpoint'
import { type SeedPluginOptions, resolveOptions } from './options'
import { buildSeedRegistry } from './typegen'

/** Absolute path to a bundled bin script, resolving the src→dist swap from this module's
 *  own location (so it works both in-workspace and when published). */
function binScriptPath(name: string): string {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

/**
 * The seed plugin. Pass your seed `definitions`; it wires up the rest so a project authors
 * no seed plumbing:
 * - `payload seed` — runs the seed (behind the `ENABLE_SEED` guard).
 * - `POST /api/seed` + the optional admin button — the in-app way to run it.
 * - typed refs — injects the `SeedRegistry` into `payload-types.ts` via Payload's
 *   `typescript.postProcess`, so `ref()` keys are checked. Rides `generate:types`.
 *
 *   seedPlugin({ definitions: [assets, services, posts], adminButton: true })
 */
export function seedPlugin(options: SeedPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)

  return (incomingConfig: Config): Config => {
    const config: Config = {
      ...incomingConfig,
      bin: [...(incomingConfig.bin ?? []), { key: 'seed', scriptPath: binScriptPath('seed') }],
      custom: { ...incomingConfig.custom, payloadSeed: { options } },
      endpoints: [...(incomingConfig.endpoints ?? []), createSeedEndpoint(resolved)],
    }

    // Inject the typed ref registry into `payload-types.ts` during type generation, from the
    // in-memory definitions. Skipped when none are passed (nothing to derive types from).
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
