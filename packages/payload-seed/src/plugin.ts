import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config, Plugin } from 'payload'
import { createSeedEndpoint } from './endpoint'
import { type SeedPluginOptions, resolveOptions } from './options'

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
 * - `payload generate:seed-types` — codegen for the typed ref registry + definitions barrel
 *   (writes a TS file, no DB; same plumbing as `payload generate:types`).
 * - `POST /api/seed` — the in-app endpoint (when `enabled`), behind the guard + `authorize`.
 * - the dashboard SeedButton (when `adminButton`).
 *
 * Seed data lives in auto-discovered `seed.ts` files authored with `defineSeed`.
 *
 *   plugins: [seedPlugin({ assets: { dir: 'assets' }, authorize: (u) => u.role === 'admin' })]
 */
export function seedPlugin(options: SeedPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)

  return (incomingConfig: Config): Config => {
    // Bin commands + the stashed options are independent of the (destructive) endpoint —
    // register them even when the endpoint is disabled, so the CLI always works.
    const config: Config = {
      ...incomingConfig,
      bin: [
        ...(incomingConfig.bin ?? []),
        { key: 'seed', scriptPath: binScriptPath('seed') },
        { key: 'generate:seed-types', scriptPath: binScriptPath('generate') },
      ],
      custom: { ...incomingConfig.custom, payloadSeed: { options } },
    }

    if (resolved.enabled) {
      config.endpoints = [...(config.endpoints ?? []), createSeedEndpoint(resolved)]
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
