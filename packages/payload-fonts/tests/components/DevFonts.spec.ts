import { afterEach, describe, expect, it, vi } from 'vitest'

import { DevFonts } from '../../src/components/DevFonts'

// Unit coverage of the two no-op guards (they return before any Payload access, so no DB is
// needed). The render branch is covered by the activeFonts + fonts-sandbox integration tests.
describe('DevFonts (guards)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders nothing in production (lets next/font own the prod path)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const el = await DevFonts({ payload: {} as never, definition: undefined })
    expect(el).toBeNull()
  })

  it('stands down in dev when the definition already has fonts', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const el = await DevFonts({ payload: {} as never, definition: { sans: { variable: 'font-x' } } })
    expect(el).toBeNull()
  })

  // The slugs the plugin resolved at boot live on the marker, so a renamed collection is followed
  // without the app passing anything.
  it('reads the renamed slugs off the marker rather than assuming the defaults', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const findGlobal = vi.fn().mockResolvedValue({})
    const payload = {
      config: { custom: { payloadFonts: { fontSetSlug: 'typography', fontOptimizedSlug: 'served', familyKeys: ['sans'] } } },
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findGlobal,
    }
    await DevFonts({ payload: payload as never, definition: undefined })
    expect(findGlobal).toHaveBeenCalledWith(expect.objectContaining({ slug: 'typography' }))
  })
})
