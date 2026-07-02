import { getPayload, type SanitizedConfig } from 'payload'
import { seed } from '../engine/run'
import { SEED_DISABLED_MESSAGE, seedingEnabled } from '../guard'
import type { SeedPluginOptions } from '../options'

/**
 * Payload custom-bin entry. `seedPlugin` registers this under `config.bin` as the `seed`
 * command, so `payload seed` runs the seed via the Local API — no per-project runner
 * script. Behind the `ENABLE_SEED` guard (the seed is destructive). Reads the plugin
 * options the project passed to `seedPlugin` from `config.custom.payloadSeed`.
 */
export const script = async (config: SanitizedConfig): Promise<void> => {
  if (!seedingEnabled()) {
    console.error(SEED_DISABLED_MESSAGE)
    process.exitCode = 1
    return
  }
  const options = (config.custom?.payloadSeed?.options ?? {}) as SeedPluginOptions
  const payload = await getPayload({ config })
  try {
    const result = await seed({ payload, options })
    // One human-sized summary line — the full result (created/order/deferred/skipped) is for
    // programmatic consumers of `seed()`, not the terminal.
    const total = Object.values(result.created).reduce((sum, n) => sum + n, 0)
    const skipped = result.skipped.length ? ` (${result.skipped.length} definition${result.skipped.length === 1 ? '' : 's'} skipped)` : ''
    payload.logger.info(`[payload-seed] created ${total} docs across ${Object.keys(result.created).length} collections${skipped}`)
  } finally {
    // Close adapter connections so the process doesn't hang on open handles.
    await payload.db.destroy?.()
  }
  process.exit(0)
}
