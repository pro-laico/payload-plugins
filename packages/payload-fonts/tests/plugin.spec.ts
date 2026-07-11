import type { Config } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { fontsPlugin } from '../src/plugin'

describe('fontsPlugin (unit)', () => {
  // fontsPlugin is synchronous; the Plugin signature is Config | Promise<Config>.
  const apply = (plugin: ReturnType<typeof fontsPlugin>, config: Partial<Config> = {}): Config => plugin(config as Config) as Config

  it('registers the font, fontOriginal, and fontOptimized collections', () => {
    const slugs = (apply(fontsPlugin()).collections ?? []).map((c) => c.slug)
    expect(slugs).toEqual(expect.arrayContaining(['font', 'fontOriginal', 'fontOptimized']))
  })

  it('opts the derived collections out of payload-revalidate (fonts are build-baked)', () => {
    const collections = apply(fontsPlugin()).collections ?? []
    for (const slug of ['fontOriginal', 'fontOptimized']) {
      expect(collections.find((c) => c.slug === slug)?.custom?.revalidate, slug).toBe(false)
    }
    // The editor-facing typeface collection keeps the standard auto-attached hooks.
    expect(collections.find((c) => c.slug === 'font')?.custom?.revalidate).toBeUndefined()
  })

  it('puts the typeface slots on `font`', () => {
    const font = (apply(fontsPlugin()).collections ?? []).find((c) => c.slug === 'font')
    const names = (font?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(names).toEqual(expect.arrayContaining(['title', 'family', 'variable', 'weights']))
  })

  it('registers the fontSet global by default, and skips it only when opted out', () => {
    expect((apply(fontsPlugin()).globals ?? []).some((g) => g.slug === 'fontSet')).toBe(true)
    expect((apply(fontsPlugin({ includeFontSet: false })).globals ?? []).some((g) => g.slug === 'fontSet')).toBe(false)
  })

  it('registers the fonts export endpoint', () => {
    const endpoints = apply(fontsPlugin()).endpoints ?? []
    expect(endpoints.some((e) => typeof e.path === 'string' && e.path.includes('/fonts/export'))).toBe(true)
  })

  it('merges fontOriginalOverrides onto the upload collection (keeps the mime whitelist)', () => {
    const collections = apply(fontsPlugin({ fontOriginalOverrides: { upload: { staticDir: '/tmp/x' } } })).collections ?? []
    const original = collections.find((c) => c.slug === 'fontOriginal')
    const upload = original?.upload as { staticDir?: string; mimeTypes?: string[] }
    expect(upload.staticDir).toBe('/tmp/x')
    expect(upload.mimeTypes).toContain('font/woff2')
  })

  it('leaves upload config untouched (uploads go to the fontOriginal collection)', () => {
    expect(apply(fontsPlugin()).upload).toBeUndefined()
  })

  it("wraps onInit (dev subsetter probe) without dropping the app's own onInit", async () => {
    const appOnInit = vi.fn()
    const config = apply(fontsPlugin(), { onInit: appOnInit })
    await config.onInit?.({ logger: { error: vi.fn() } } as never)
    expect(appOnInit).toHaveBeenCalledOnce()
  })

  it('is a no-op when disabled', () => {
    const config = { collections: [] } as unknown as Config
    expect(fontsPlugin({ enabled: false })(config)).toBe(config)
  })

  it('trims `font` defaultPopulate so a populated relationship omits the private upload slots', () => {
    const font = (apply(fontsPlugin()).collections ?? []).find((c) => c.slug === 'font')
    // Only identifying metadata is populated — not `variable`/`weights` (which would drag in the
    // private fontOriginal blobs).
    expect(font?.defaultPopulate).toEqual({ title: true, family: true })
  })

  describe('custom families', () => {
    // Pull the option values off the `family` radio field.
    const familyValues = (config: Config): string[] => {
      const font = (config.collections ?? []).find((c) => c.slug === 'font')
      const family = (font?.fields ?? []).find((f) => 'name' in f && f.name === 'family') as { options?: Array<{ value: string }> } | undefined
      return (family?.options ?? []).map((o) => o.value)
    }
    // Pull the relationship slot names off the fontSet global (fields are rows of slots).
    const slotNames = (config: Config): string[] => {
      const global = (config.globals ?? []).find((g) => g.slug === 'fontSet')
      return (global?.fields ?? []).flatMap((row) =>
        'fields' in row ? row.fields.flatMap((f) => ('name' in f && f.name ? [f.name] : [])) : [],
      )
    }

    it('defaults the family options and fontSet slots to sans/serif/mono/display', () => {
      const config = apply(fontsPlugin())
      expect(familyValues(config)).toEqual(['sans', 'serif', 'mono', 'display'])
      expect(slotNames(config)).toEqual(['sans', 'serif', 'mono', 'display'])
    })

    it('replaces, extends, and reorders both the family options and the fontSet slots in lockstep', () => {
      const families = [{ key: 'display' }, { key: 'sans' }, { key: 'brand', fallback: 'Georgia, serif' }]
      const config = apply(fontsPlugin({ families }))
      expect(familyValues(config)).toEqual(['display', 'sans', 'brand'])
      expect(slotNames(config)).toEqual(['display', 'sans', 'brand'])
    })

    it('labels a custom family by capitalising its key unless a label is given', () => {
      const config = apply(fontsPlugin({ families: [{ key: 'brand' }, { key: 'mono', label: 'Code' }] }))
      const global = (config.globals ?? []).find((g) => g.slug === 'fontSet')
      const slots = (global?.fields ?? []).flatMap((row) => ('fields' in row ? row.fields : [])) as Array<{
        name?: string
        label?: string
      }>
      expect(slots.find((s) => s.name === 'brand')?.label).toBe('Brand')
      expect(slots.find((s) => s.name === 'mono')?.label).toBe('Code')
    })
  })
})
