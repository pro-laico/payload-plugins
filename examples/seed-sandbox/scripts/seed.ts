import config from '@payload-config'
import { SEED_DISABLED_MESSAGE, seed, seedingEnabled } from '@pro-laico/payload-seed'
import { getPayload } from 'payload'

// Run via `pnpm seed` (`payload run scripts/seed.ts`). `payload run` awaits the module's
// top-level code, so this MUST use top-level await — a floating promise would exit 0
// having done nothing.
if (!seedingEnabled()) {
  console.error(`✗ ${SEED_DISABLED_MESSAGE}`)
  process.exit(1)
}

const payload = await getPayload({ config })
const result = await seed({ payload, options: { assets: { dir: 'assets', collection: 'media' } } })
payload.logger.info({ msg: '✓ seed complete', ...result })
process.exit(0)
