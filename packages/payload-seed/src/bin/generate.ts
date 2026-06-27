import type { SanitizedConfig } from 'payload'
import { generateSeedTypes } from '../generate'
import type { SeedPluginOptions } from '../options'

/**
 * Payload custom-bin entry. `seedPlugin` registers this under `config.bin` as the
 * `generate:seed-types` command, so `payload generate:seed-types` runs it — the same
 * plumbing as `payload generate:types`. Payload's bin loads the config and calls `script(config)`
 * WITHOUT booting Payload or a DB, so this never hits the local-API runtime issues; it
 * just discovers the seed files and writes the generated module.
 *
 * Discovery/output config is read from `config.custom.payloadSeed` (stashed by the plugin).
 */
export const script = async (config: SanitizedConfig): Promise<void> => {
  const options = (config.custom?.payloadSeed?.options ?? {}) as SeedPluginOptions
  const discover = typeof options.discover === 'string' ? [options.discover] : options.discover
  const result = await generateSeedTypes({ discover, out: options.generate?.out })
  const summary = `${Object.keys(result.collections).length} collection(s), ${result.globals.length} global(s), ${result.assets.length} asset(s)`
  console.log(`[payload-seed] wrote ${result.out} from ${result.files} definition file(s) — ${summary}`)
}
