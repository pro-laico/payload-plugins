import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { formatSvg } from './formatSVG'

// A no-op logger matching the bits formatSvg touches.
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Payload['logger']

const run = (svg: string) => formatSvg({ filename: 'icon.svg' }, Buffer.from(svg), logger)

describe('formatSvg', () => {
  it('optimizes a valid SVG, themes it with currentColor, and reports the reduction', async () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="#ff0000">
      <path d="M10 14 L30 14 L20 34 Z" fill="#ff0000"/>
    </svg>`
    const out = await run(dirty)

    expect(out.svgString).toContain('<svg')
    expect(out.svgString).toContain('currentColor')
    // Hard-coded width/height are dropped (removeDimensions) and the red fill is gone.
    expect(out.svgString).not.toMatch(/width="48"/)
    expect(out.svgString).not.toContain('#ff0000')
    expect(out.optimized).toMatch(/^SVG optimized: \d+ to \d+ bytes \([\d.]+% reduction\)$/)
    expect(out.filesize).toBe(Buffer.from(out.svgString as string).length)
  })

  it('sanitizes scripts, on* handlers, and javascript: URLs (the stored string is inlined)', async () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" onclick="alert(1)">
      <script>alert('xss')</script>
      <a xlink:href="javascript:alert(2)"><path d="M2 2 h6 v6 h-6 z"/></a>
    </svg>`
    const out = await run(malicious)

    expect(out.svgString).not.toContain('<script')
    expect(out.svgString).not.toMatch(/onclick/i)
    expect(out.svgString).not.toMatch(/javascript:/i)
  })

  it('tightens and squares the viewBox to the real path bounds', async () => {
    // A 10×20 path inside a loose 0 0 100 100 box → squared to side 20 around the glyph center.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 h10 v20 h-10 z"/></svg>'
    const out = await run(svg)
    const viewBox = out.svgString?.match(/viewBox="([^"]+)"/)?.[1]
    expect(viewBox).toBeDefined()
    const [, , w, h] = (viewBox as string).split(' ').map(Number)
    expect(w).toBeCloseTo(20, 1)
    expect(h).toBeCloseTo(20, 1)
  })

  it('skips geometry optimization for transform/clip-path SVGs but still strips scripts', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <script>alert('xss')</script>
      <g transform="translate(2 2)"><path d="M0 0 h4 v4 h-4 z"/></g>
    </svg>`
    const out = await run(svg)
    expect(out.optimized).toMatch(/Skipped optimization/)
    expect(out.svgString).not.toContain('<script')
    // The transform is preserved (geometry untouched).
    expect(out.svgString).toContain('transform')
  })

  it('reports the failure in `optimized` when the SVG cannot be parsed (no svgString stored)', async () => {
    // Undeclared `xlink:` namespace → svgo throws → no svgString, but the doc reports the failure.
    const broken = '<svg viewBox="0 0 24 24"><a xlink:href="#x"><path d="M0 0"/></a></svg>'
    const out = await run(broken)
    expect(out.svgString).toBeUndefined()
    expect(out.optimized).toMatch(/^Optimization failed: .+ — icon will not render\.$/)
    expect(logger.error).toHaveBeenCalled()
  })

  it('warns on a stroke-based icon (fill="none" + stroke) but still processes it', async () => {
    const lucide = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2">
      <path d="M5 12 h14"/>
    </svg>`
    const out = await run(lucide)
    expect(out.optimized).toMatch(/^Warning: stroke-based icon detected/)
    expect(out.optimized).toMatch(/SVG optimized:/) // the normal report still follows the warning
    expect(out.svgString).toContain('<svg')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('stroke-based icon detected'))
  })

  it('does not flag a fill-based icon as stroke-based', async () => {
    const filled = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2 h20 v20 h-20 z"/></svg>'
    const out = await run(filled)
    expect(out.optimized).not.toMatch(/stroke-based/)
    expect(out.optimized).toMatch(/^SVG optimized:/)
  })
})
