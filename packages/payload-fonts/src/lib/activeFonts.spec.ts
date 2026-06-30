import { describe, expect, it, vi } from 'vitest'

import { type ActiveTypeface, buildFontFaceCss, getActiveFontFaces } from './activeFonts'

const typefaces: ActiveTypeface[] = [
  { role: 'sans', id: 1, faces: [{ filename: 'inter.woff2', weight: '400', style: 'normal' }] },
  {
    role: 'display',
    id: 7,
    faces: [
      { filename: 'abril-400.woff2', weight: '400', style: 'normal' },
      { filename: 'abril-700.woff2', weight: '700', style: 'normal' },
    ],
  },
]

describe('buildFontFaceCss', () => {
  it('returns empty string when there are no typefaces', () => {
    expect(buildFontFaceCss([])).toBe('')
  })

  it('emits one @font-face per served file, pointing at the public file route', () => {
    const css = buildFontFaceCss(typefaces)
    expect(css.match(/@font-face\{/g)).toHaveLength(3)
    expect(css).toContain("src:url('/api/fontOptimized/file/inter.woff2') format('woff2')")
    expect(css).toContain("src:url('/api/fontOptimized/file/abril-700.woff2') format('woff2')")
    expect(css).toContain('font-weight:700')
  })

  it('maps each role to a --font-set* variable pointing at its served family', () => {
    const css = buildFontFaceCss(typefaces)
    expect(css).toContain("--font-setSans:'pl-font-1',ui-sans-serif")
    expect(css).toContain("--font-setDisplay:'pl-font-7',ui-serif")
  })

  it('honors a custom CSS-variable prefix and optimized slug', () => {
    const css = buildFontFaceCss(typefaces, { cssVarPrefix: '--type', optimizedSlug: 'webfonts' })
    expect(css).toContain('--typeSans:')
    expect(css).toContain('/api/webfonts/file/inter.woff2')
  })

  it('emits italic style and a variable weight range verbatim', () => {
    const css = buildFontFaceCss([
      {
        role: 'serif',
        id: 9,
        faces: [
          { filename: 'src-italic.woff2', weight: '400', style: 'italic' },
          { filename: 'src-variable.woff2', weight: '100 900', style: 'normal' },
        ],
      },
    ])
    expect(css).toContain('font-style:italic')
    expect(css).toContain('font-weight:100 900')
    // Both faces share the one family the role variable points at: 2 @font-face + the :root var.
    expect(css.match(/'pl-font-9'/g)).toHaveLength(3)
  })

  it('encodes filenames with spaces in the served URL', () => {
    const css = buildFontFaceCss([{ role: 'mono', id: 3, faces: [{ filename: 'My Mono.woff2', weight: '400', style: 'normal' }] }])
    expect(css).toContain('/api/fontOptimized/file/My%20Mono.woff2')
  })

  it('supports a custom role with a per-role fallback override, capitalising its var name', () => {
    const css = buildFontFaceCss([{ role: 'brand', id: 5, faces: [{ filename: 'b.woff2', weight: '400', style: 'normal' }] }], {
      fallbacks: { brand: 'Georgia, serif' },
    })
    expect(css).toContain("--font-setBrand:'pl-font-5',Georgia, serif")
  })

  it('falls back to a generic sans stack for a custom role with no declared fallback', () => {
    const css = buildFontFaceCss([{ role: 'brand', id: 5, faces: [{ filename: 'b.woff2', weight: '400', style: 'normal' }] }])
    expect(css).toContain("--font-setBrand:'pl-font-5',ui-sans-serif, system-ui, sans-serif")
  })
})

describe('getActiveFontFaces', () => {
  // A payload double: the fontSet global selection + the served fontOptimized docs the one
  // batched find should return (filtered here by the `font: { in: [...] }` clause).
  const makePayload = (selection: Record<string, unknown>, docs: Array<Record<string, unknown>>) => {
    const find = vi.fn(async ({ where }: { where: { font: { in: Array<string | number> } } }) => ({
      docs: docs.filter((d) => where.font.in.includes(d.font as string | number)),
    }))
    return { payload: { findGlobal: vi.fn(async () => selection), find } as never, find }
  }

  it('resolves each role to its served faces in ONE query, preserving role order', async () => {
    const { payload, find } = makePayload({ sans: 1, mono: 2 }, [
      { filename: 'inter.woff2', font: 1, weight: '400', style: 'normal' },
      { filename: 'jbm.woff2', font: 2, weight: '400', style: 'normal' },
    ])
    const out = await getActiveFontFaces(payload, { roles: ['sans', 'serif', 'mono'] })
    expect(find).toHaveBeenCalledTimes(1) // batched, not one-per-role
    expect(find.mock.calls[0]?.[0].where).toEqual({ font: { in: [1, 2] } })
    expect(out.map((t) => t.role)).toEqual(['sans', 'mono']) // serif unselected → dropped, order kept
    expect(out[0]?.faces).toEqual([{ filename: 'inter.woff2', weight: '400', style: 'normal' }])
  })

  it('handles a populated relationship object and two roles sharing one typeface', async () => {
    const { payload, find } = makePayload(
      { sans: { id: 9 }, display: { id: 9 } }, // same typeface in two slots
      [{ filename: 'x.woff2', font: 9, weight: '400', style: 'normal' }],
    )
    const out = await getActiveFontFaces(payload, { roles: ['sans', 'display'] })
    expect(find.mock.calls[0]?.[0].where).toEqual({ font: { in: [9] } }) // deduped id
    expect(out.map((t) => t.role)).toEqual(['sans', 'display']) // both resolve
  })

  it('returns [] without querying when nothing is selected', async () => {
    const { payload, find } = makePayload({}, [])
    expect(await getActiveFontFaces(payload, { roles: ['sans'] })).toEqual([])
    expect(find).not.toHaveBeenCalled()
  })
})
