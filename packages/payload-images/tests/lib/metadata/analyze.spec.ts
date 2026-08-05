import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { analyzeImageMetadata } from '../../../src/lib/metadata/analyze'

const solid = (width: number, height: number, background: { r: number; g: number; b: number }): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer()

const withSpot = async (width: number, height: number, spotX: number, spotY: number): Promise<Buffer> => {
  const spot = 80
  return sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } } })
    .composite([
      {
        input: await solid(spot, spot, { r: 255, g: 40, b: 40 }),
        left: Math.round(spotX - spot / 2),
        top: Math.round(spotY - spot / 2),
      },
    ])
    .png()
    .toBuffer()
}

describe('analyzeImageMetadata attention focal', () => {
  it('finds an interior subject near its true position', async () => {
    const { attention } = await analyzeImageMetadata(await withSpot(1200, 800, 900, 600))
    expect(attention).toBeDefined()
    expect(attention!.x).toBeGreaterThan(55)
    expect(attention!.x).toBeLessThan(90)
    expect(attention!.y).toBeGreaterThan(55)
    expect(attention!.y).toBeLessThan(90)
  })

  it('a uniform image yields no attention instead of a (0,0) corner focal', async () => {
    const { attention } = await analyzeImageMetadata(await solid(1200, 800, { r: 200, g: 200, b: 200 }))
    expect(attention).toBeUndefined()
  })

  it('a smooth gradient yields no attention instead of an edge-pinned corner focal', async () => {
    const svg = `<svg width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#87ceeb"/><stop offset="1" stop-color="#f0e68c"/>
    </linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/></svg>`
    const { attention } = await analyzeImageMetadata(await sharp(Buffer.from(svg)).png().toBuffer())
    expect(attention).toBeUndefined()
  })
})
