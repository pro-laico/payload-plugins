import { describe, expect, it } from 'vitest'

import { type ActiveTypeface, buildFontFaceCss } from './activeFonts'

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
})
