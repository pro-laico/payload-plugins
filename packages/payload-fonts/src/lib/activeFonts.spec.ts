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
})
