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
 * The seed plugin. It wires up everything a project needs so it doesn't author its own
 * seed plumbing:
 * - `payload seed` — runs the seed (writes data, behind the `ENABLE_SEED` guard).
 * - **typed refs in `payload-types.ts`** — when `definitions` are supplied, the plugin
 *   injects the `SeedRegistry` augmentation into Payload's generated types via
 *   `typescript.postProcess`, so `ref()`/`asset()` keys are type-checked. It rides
 *   `payload generate:types` (and dev `autoGenerate`) — no separate codegen command.
 * - `POST /api/seed` — the in-app endpoint (when `enabled`), behind the guard + `authorize`.
 * - the dashboard SeedButton (when `adminButton`).
 *
 * Pass your seed definitions (authored with `defineSeed` in `seed.ts` files, e.g. assembled
 * in a `plugins/` barrel); they feed both the seed run and the generated types.
 *
 *   seedPlugin({ definitions: [assets, services, posts], assets: { dir: 'assets' } })
 */
export function seedPlugin(options: SeedPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)

  return (incomingConfig: Config): Config => {
    // The `seed` command is independent of the (destructive) endpoint — register it even
    // when the endpoint is disabled, so the CLI always works.
    const config: Config = {
      ...incomingConfig,
      bin: [...(incomingConfig.bin ?? []), { key: 'seed', scriptPath: binScriptPath('seed') }],
      custom: { ...incomingConfig.custom, payloadSeed: { options } },
    }

    // Inject the typed ref registry into `payload-types.ts` during type generation. Needs
    // the definitions in-memory; without `definitions` there's nothing to derive types from,
    // so it's skipped.
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

    if (resolved.enabled) {
      config.endpoints = [...(config.endpoints ?? []), createSeedEndpoint(resolved)]
    }

    if (resolved.adminButton) {
      const slot = resolved.adminButton
      const components = config.admin?.components ?? {}
      const existing = (components[slot] ?? []) as unknown[]
      config.admin = {
        ...config.admin,
        components: { ...components, [slot]: [...existing, '@pro-laico/payload-seed/components/SeedButton#SeedButton'] },
      }
    }

    return config
  }
}
