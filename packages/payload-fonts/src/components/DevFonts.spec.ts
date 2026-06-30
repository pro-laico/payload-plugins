import { afterEach, describe, expect, it, vi } from 'vitest'

import { DevFonts } from './DevFonts'

// Unit coverage of the two no-op guards (they return before any Payload access, so no DB is
// needed). The render branch is covered by the activeFonts + fonts-sandbox integration tests.
describe('DevFonts (guards)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders nothing in production (lets next/font own the prod path)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const el = await DevFonts({ config: {} as never, definition: undefined })
    expect(el).toBeNull()
  })

  it('stands down in dev when the definition already has fonts', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const el = await DevFonts({ config: {} as never, definition: { sans: { variable: 'font-x' } } })
    expect(el).toBeNull()
  })
})
