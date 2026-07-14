import { getPayload, type SanitizedConfig } from 'payload'

import { seed } from '../engine/run'
import type { SeedPluginOptions } from '../types'
import { SEED_DISABLED_MESSAGE, seedingEnabled } from '../guard'

export const script = async (config: SanitizedConfig): Promise<void> => {
  if (!seedingEnabled()) {
    console.error(SEED_DISABLED_MESSAGE)
    process.exitCode = 1
    return
  }
  const options = (config.custom?.payloadSeed?.options ?? {}) as SeedPluginOptions //TODO: replace `as` cast with proper typing
  const payload = await getPayload({ config })
  try {
    const result = await seed({ payload, options })
    const total = Object.values(result.created).reduce((sum, n) => sum + n, 0)
    const skipped = result.skipped.length ? ` (${result.skipped.length} definition${result.skipped.length === 1 ? '' : 's'} skipped)` : ''
    payload.logger.info(`[payload-seed] created ${total} docs across ${Object.keys(result.created).length} collections${skipped}`)
  } finally {
    await payload.db.destroy?.()
  }
  process.exit(0)
}
