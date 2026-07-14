import { describe, expect, it } from 'vitest'

import { placeholderAfterRead } from '../../src/hooks/field/placeholder'

// A real 4×3-component (sm-tier) blurhash + a 9×9 (xl) one, with source dims for the natural ratio.
const doc = {
  id: 1,
  width: 1600,
  height: 900,
  blurHashSm: 'LJJtSD~pIp?Zx]^*E2D%I;xuoejF',
  blurHashXl:
    '|JJtSD~pIp?Z?HjaM{kBbbx]^*E2D%WBWCaxayazI;xuoejFayR*WCs:of^+kXR*xtxtson%oykC?ux]s:M{IoWVoyoMjao}WqM|n$aefjf+ozf79GsmoyR*f6jZofkCkCofWXt7oej?WVWCWBay%LkCWBf6WBj[ofofoL',
}

const run = (context?: Record<string, unknown>) =>
  (placeholderAfterRead as (args: { data: unknown; req: unknown }) => Promise<string | null>)({
    data: doc,
    req: context ? { context } : {},
  })

describe('placeholder afterRead — blur is opt-in', () => {
  it('returns null for a read that declared nothing (no unrequested data-URI bloat)', async () => {
    expect(await run()).toBeNull()
  })

  it('returns null for a declared image render without a blur intent', async () => {
    expect(await run({ image: {} })).toBeNull()
    expect(await run({ image: { aspectRatio: '1:1' } })).toBeNull()
  })

  it('returns a finished data URI for a declared blur tier alone', async () => {
    const out = await run({ blur: { quality: 'md' } })
    expect(out).toMatch(/^data:image\/png;base64,/)
  })

  it('returns a finished data URI for an empty blur intent (default tier)', async () => {
    const out = await run({ blur: {} })
    expect(out).toMatch(/^data:image\/png;base64,/)
  })

  it('crops to the declared image ratio when a blur is requested alongside it', async () => {
    const out = await run({ image: { aspectRatio: '1:1' }, blur: { quality: 'md' } })
    expect(out).toMatch(/^data:image\/png;base64,/)
  })

  it("still answers blur.format: 'hash' with a raw hash string (client-side decoders)", async () => {
    const out = await run({ image: { aspectRatio: '1:1' }, blur: { format: 'hash' } })
    expect(out).toBeTypeOf('string')
    expect(out).not.toMatch(/^data:/)
  })
})
