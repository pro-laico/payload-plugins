import { afterEach, describe, expect, it, vi } from 'vitest'

import { PreviewFonts } from '../../src/components/PreviewFonts'

// PreviewFonts is the live-selection escape hatch: no NODE_ENV gate and no baked stand-down, so it
// runs the same everywhere. These cover the no-DB branches (marker read, empty selection → null) and
// prove the gates DevFonts had are gone.
describe('PreviewFonts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const payloadWith = (marker: Record<string, unknown>, docs: unknown[] = []) => ({
    config: { custom: { payloadFonts: marker } },
    find: vi.fn().mockResolvedValue({ docs }),
    findGlobal: vi.fn().mockResolvedValue({}),
  })

  it('runs in production too — no NODE_ENV gate (DevFonts returned null here)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const payload = payloadWith({ fontSetSlug: 'fontSet', fontOptimizedSlug: 'fontOptimized', familyKeys: ['sans'] })
    await PreviewFonts({ payload: payload as never })
    expect(payload.findGlobal).toHaveBeenCalled() // it queried instead of bailing out on env
  })

  it('reads the renamed slugs off the marker rather than assuming the defaults', async () => {
    const payload = payloadWith({ fontSetSlug: 'typography', fontOptimizedSlug: 'served', familyKeys: ['sans'] })
    await PreviewFonts({ payload: payload as never })
    expect(payload.findGlobal).toHaveBeenCalledWith(expect.objectContaining({ slug: 'typography' }))
  })

  it('renders nothing when there is no active selection', async () => {
    const payload = payloadWith({ fontSetSlug: 'fontSet', fontOptimizedSlug: 'fontOptimized', familyKeys: ['sans'] })
    const el = await PreviewFonts({ payload: payload as never })
    expect(el).toBeNull()
  })
})
