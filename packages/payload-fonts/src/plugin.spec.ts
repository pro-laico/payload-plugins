import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'

import { fontsPlugin } from './plugin'
import { fontAssetProvider, fontSource } from './seed'

describe('fontsPlugin (unit)', () => {
  // fontsPlugin is synchronous; the Plugin signature is Config | Promise<Config>.
  const apply = (plugin: ReturnType<typeof fontsPlugin>, config: Partial<Config> = {}): Config => plugin(config as Config) as Config

  it('registers the font, fontOriginal, and fontOptimized collections', () => {
    const slugs = (apply(fontsPlugin()).collections ?? []).map((c) => c.slug)
    expect(slugs).toEqual(expect.arrayContaining(['font', 'fontOriginal', 'fontOptimized']))
  })

  it('puts the typeface slots + a server-side `source` seam on `font`', () => {
    const font = (apply(fontsPlugin()).collections ?? []).find((c) => c.slug === 'font')
    const names = (font?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(names).toEqual(expect.arrayContaining(['title', 'family', 'source', 'variable', 'weights']))
  })

  it('registers the fontSet global by default, and skips it only when opted out', () => {
    expect((apply(fontsPlugin()).globals ?? []).some((g) => g.slug === 'fontSet')).toBe(true)
    expect((apply(fontsPlugin({ includeFontSet: false })).globals ?? []).some((g) => g.slug === 'fontSet')).toBe(false)
  })

  it('registers the fonts export endpoint', () => {
    const endpoints = apply(fontsPlugin()).endpoints ?? []
    expect(endpoints.some((e) => typeof e.path === 'string' && e.path.includes('/fonts/export'))).toBe(true)
  })

  it('merges fontOriginalOptions onto the upload collection (keeps the mime whitelist)', () => {
    const collections = apply(fontsPlugin({ fontOriginalOptions: { upload: { staticDir: '/tmp/x' } } })).collections ?? []
    const original = collections.find((c) => c.slug === 'fontOriginal')
    const upload = original?.upload as { staticDir?: string; mimeTypes?: string[] }
    expect(upload.staticDir).toBe('/tmp/x')
    expect(upload.mimeTypes).toContain('font/woff2')
  })

  it('leaves upload config untouched (uploads go to the fontOriginal collection)', () => {
    expect(apply(fontsPlugin()).upload).toBeUndefined()
  })

  it('is a no-op when disabled', () => {
    const config = { collections: [] } as unknown as Config
    expect(fontsPlugin({ enabled: false })(config)).toBe(config)
  })

  it('exposes a decoupled seed provider + source token', () => {
    expect(fontAssetProvider()).toEqual({ token: 'font', collection: 'font', sourceDir: 'fonts' })
    expect(fontAssetProvider({ sourceDir: 'webfonts' }).sourceDir).toBe('webfonts')
    expect(fontSource('inter.woff2', { weight: '400' })).toEqual({
      __seedRef: 'source',
      token: 'font',
      file: 'inter.woff2',
      options: { weight: '400' },
    })
  })
})
