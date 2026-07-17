import { buildConfig, type Config } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
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
    expect((apply(fontsPlugin({ globals: { fontSet: false } })).globals ?? []).some((g) => g.slug === 'fontSet')).toBe(false)
  })

  it('registers the fonts export endpoint', () => {
    const endpoints = apply(fontsPlugin()).endpoints ?? []
    expect(endpoints.some((e) => typeof e.path === 'string' && e.path.includes('/fonts/export'))).toBe(true)
  })

  it('merges collections.fontOriginal onto the upload collection (keeps the mime whitelist)', () => {
    const collections =
      apply(fontsPlugin({ collections: { fontOriginal: { overrides: { upload: { staticDir: '/tmp/x' } } } } })).collections ?? []
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

  describe('renaming a collection (collections.<name>.slug)', () => {
    // Renaming used to boot-fail: the plugin hardcoded 'font' as the fontOptimized relationship's
    // target while honouring the override everywhere else, so Payload rejected the config with
    // "Field Font has invalid relationship 'font'". Every reference is threaded from the resolved
    // slug now, and buildConfig below is the proof — it runs Payload's own relationship validation.
    const relationTo = (config: Config, collection: string, field: string): unknown => {
      const fields = (config.collections ?? []).find((c) => c.slug === collection)?.fields ?? []
      const found = fields.find((f) => 'name' in f && f.name === field)
      return found && 'relationTo' in found ? found.relationTo : undefined
    }

    it('points the fontOptimized → font relationship at the renamed collection', () => {
      const config = apply(fontsPlugin({ collections: { font: { slug: 'typefaces' } } }))
      expect((config.collections ?? []).map((c) => c.slug)).toEqual(expect.arrayContaining(['typefaces', 'fontOriginal', 'fontOptimized']))
      expect((config.collections ?? []).some((c) => c.slug === 'font')).toBe(false)
      expect(relationTo(config, 'fontOptimized', 'font')).toBe('typefaces')
    })

    it('points the fontSet global slots at the renamed font collection', () => {
      const config = apply(fontsPlugin({ collections: { font: { slug: 'typefaces' } } }))
      const global = (config.globals ?? []).find((g) => g.slug === 'fontSet')
      const slots = (global?.fields ?? []).flatMap((row) => ('fields' in row ? row.fields : []))
      expect(slots.length).toBeGreaterThan(0)
      for (const slot of slots) expect('relationTo' in slot ? slot.relationTo : undefined).toBe('typefaces')
    })

    it('reports the renamed slug on the marker the fonts:download bin reads', () => {
      const config = apply(fontsPlugin({ collections: { font: { slug: 'typefaces' } } }))
      expect(config.custom?.payloadFonts).toMatchObject({ fontSlug: 'typefaces', fontOriginalSlug: 'fontOriginal' })
    })

    it('threads a renamed fontOriginal into the upload slots and a renamed fontOptimized onto the marker', () => {
      const config = apply(fontsPlugin({ collections: { fontOriginal: { slug: 'faces' }, fontOptimized: { slug: 'served' } } }))
      expect(relationTo(config, 'served', 'original')).toBe('faces')
      const variable = ((config.collections ?? []).find((c) => c.slug === 'font')?.fields ?? []).find(
        (f) => 'name' in f && f.name === 'variable',
      )
      const uploads = (variable && 'fields' in variable ? variable.fields : []).flatMap((row) => ('fields' in row ? row.fields : []))
      for (const upload of uploads) expect('relationTo' in upload ? upload.relationTo : undefined).toBe('faces')
      expect(config.custom?.payloadFonts).toMatchObject({ fontOriginalSlug: 'faces', fontOptimizedSlug: 'served' })
    })

    it('renames the fontSet global', () => {
      const config = apply(fontsPlugin({ globals: { fontSet: { slug: 'typography' } } }))
      expect((config.globals ?? []).map((g) => g.slug)).toEqual(['typography'])
      expect(config.custom?.payloadFonts).toMatchObject({ fontSetSlug: 'typography' })
    })

    it('boots Payload with every collection and the global renamed', async () => {
      const config = await buildConfig({
        secret: 'test-secret',
        db: sqliteAdapter({ client: { url: ':memory:' } }),
        plugins: [
          fontsPlugin({
            collections: { font: { slug: 'typefaces' }, fontOriginal: { slug: 'faces' }, fontOptimized: { slug: 'served' } },
            globals: { fontSet: { slug: 'typography' } },
          }),
        ],
      })
      expect(config.collections.map((c) => c.slug)).toEqual(expect.arrayContaining(['typefaces', 'faces', 'served']))
      expect(config.globals.map((g) => g.slug)).toEqual(['typography'])
    })

    it('boots Payload with the default slugs', async () => {
      const config = await buildConfig({
        secret: 'test-secret',
        db: sqliteAdapter({ client: { url: ':memory:' } }),
        plugins: [fontsPlugin()],
      })
      expect(config.collections.map((c) => c.slug)).toEqual(expect.arrayContaining(['font', 'fontOriginal', 'fontOptimized']))
    })
  })

  describe('field collisions', () => {
    it('names the plugin, the collection, and the field when an override redefines one', () => {
      expect(() => apply(fontsPlugin({ collections: { font: { overrides: { fields: [{ name: 'title', type: 'text' }] } } } }))).toThrow(
        /\[payload-fonts\] collections\.font: field\(s\) title are already defined by the plugin/,
      )
    })

    it('appends a non-colliding field', () => {
      const config = apply(fontsPlugin({ collections: { font: { overrides: { fields: [{ name: 'notes', type: 'text' }] } } } }))
      const names = ((config.collections ?? []).find((c) => c.slug === 'font')?.fields ?? []).flatMap((f) =>
        'name' in f && f.name ? [f.name] : [],
      )
      expect(names).toContain('notes')
    })
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
      const config = apply(fontsPlugin({ options: { families } }))
      expect(familyValues(config)).toEqual(['display', 'sans', 'brand'])
      expect(slotNames(config)).toEqual(['display', 'sans', 'brand'])
    })

    it('labels a custom family by capitalising its key unless a label is given', () => {
      const config = apply(fontsPlugin({ options: { families: [{ key: 'brand' }, { key: 'mono', label: 'Code' }] } }))
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
