import type { CollectionConfig, Config, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { imagesPlugin } from '../src/plugin'

const baseConfig = (collections: CollectionConfig[] = []): Config => ({ collections }) as Config
// The Payload `Plugin` type returns `Config | Promise<Config>`; this plugin is synchronous, so
// narrow back to `Config` for the assertions.
const run = (opts?: Parameters<typeof imagesPlugin>[0], collections: CollectionConfig[] = []): Config =>
  imagesPlugin(opts)(baseConfig(collections)) as Config
const byName = (fields: Field[], name: string) => fields.find((f) => 'name' in f && f.name === name)
const slugs = (c: Config) => (c.collections ?? []).map((col) => col.slug)
const variantSourceRelTo = (c: Config, variantSlug = 'generated-images'): string | undefined => {
  const gen = (c.collections ?? []).find((col) => col.slug === variantSlug)
  const source = (gen?.fields ?? []).find((f) => 'name' in f && f.name === 'source')
  return (source as { relationTo?: string } | undefined)?.relationTo
}

describe('imagesPlugin — default (creates the images collection)', () => {
  const out = run()

  it('registers images + the hidden generated-images cache', () => {
    expect(slugs(out)).toEqual(expect.arrayContaining(['images', 'generated-images']))
  })

  it('points the variant cache `source` at images', () => {
    expect(variantSourceRelTo(out)).toBe('images')
  })

  it('registers the transform + purge endpoints', () => {
    const paths = (out.endpoints ?? []).map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/:id', 'post /img/purge/:id']))
  })

  it('stashes the resolved config on config.custom for external tooling', () => {
    const stash = (out.custom as { payloadImages?: { sourceSlug?: string; variantSlug?: string } }).payloadImages
    expect(stash?.sourceSlug).toBe('images')
    expect(stash?.variantSlug).toBe('generated-images')
  })

  it('folders + maxOriginalSize are off by default, opt-in on the images collection', () => {
    const imagesOf = (c: Config) =>
      (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig & {
        folders?: unknown
        upload?: { resizeOptions?: { width?: number; height?: number; fit?: string; withoutEnlargement?: boolean } }
      }

    const off = imagesOf(out)
    expect(off.folders).toBeUndefined()
    expect(off.upload?.resizeOptions).toBeUndefined() // original kept untouched

    const on = imagesOf(run({ folders: true, maxOriginalSize: 4096 }))
    expect(on.folders).toBe(true)
    expect(on.upload?.resizeOptions).toMatchObject({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
  })

  it('registers nothing when enabled is false', () => {
    const off = run({ enabled: false })
    expect(off.collections ?? []).toHaveLength(0)
    expect(off.endpoints ?? []).toHaveLength(0)
  })

  it('does not register the endpoints when transform is false', () => {
    const out2 = run({ transform: false })
    expect(slugs(out2)).toEqual(expect.arrayContaining(['images', 'generated-images']))
    expect(out2.endpoints ?? []).toHaveLength(0)
  })

  it('transform: false also drops the endpoint-dependent surface (virtual URLs, purge button, variants join)', () => {
    const images = (run({ transform: false }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect(byName(images.fields, 'src')).toBeUndefined() // virtualFields defaults off — the URLs would 404
    expect(byName(images.fields, 'purgeVariants')).toBeUndefined()
    expect(byName(images.fields, 'variants')).toBeUndefined()
    expect(byName(images.fields, 'focalPreview')).toBeTruthy() // focal UI stays — it doesn't need the endpoints
    // …but an EXPLICIT virtualFields: true is honored (warned at boot).
    const forced = (run({ transform: false, virtualFields: true }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect(byName(forced.fields, 'src')).toBeTruthy()
  })

  it('validates transform.sourceSlug like extendCollection (existence + upload)', () => {
    const pages: CollectionConfig = { slug: 'pages', fields: [] }
    expect(() => run({ transform: { sourceSlug: 'nope' } })).toThrow(/not found/)
    expect(() => run({ transform: { sourceSlug: 'pages' } }, [pages])).toThrow(/not an upload/)
    const media: CollectionConfig = { slug: 'media', upload: true, fields: [] }
    expect(slugs(run({ transform: { sourceSlug: 'media' } }, [media]))).toContain('images') // registration unchanged
  })
})

describe('imagesPlugin — extendCollection (enhances an existing upload collection)', () => {
  const media: CollectionConfig = { slug: 'media', upload: true, fields: [{ name: 'alt', type: 'text' }] }
  const out = run({ extendCollection: 'media' }, [media])

  it('does NOT create a second `images` collection', () => {
    expect(slugs(out)).not.toContain('images')
    expect(slugs(out)).toEqual(expect.arrayContaining(['media', 'generated-images']))
  })

  it('injects the variants join, focalPoint, and purge hooks onto the target (keeping its own fields)', () => {
    const m = (out.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    expect(byName(m.fields, 'variants')?.type).toBe('join')
    expect(byName(m.fields, 'alt')).toBeTruthy() // the target's own field is preserved
    expect((m.upload as { focalPoint?: boolean }).focalPoint).toBe(true)
    expect(m.hooks?.afterChange ?? []).not.toHaveLength(0)
    expect(m.hooks?.beforeDelete ?? []).not.toHaveLength(0)
  })

  it('points the variant cache `source` at the extended collection', () => {
    expect(variantSourceRelTo(out)).toBe('media')
  })

  it('applies folders to the extended target', () => {
    const withFolders = run({ extendCollection: 'media', folders: true }, [media])
    const m = (withFolders.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig & { folders?: unknown }
    expect(m.folders).toBe(true)
  })

  it('wires defaultPopulate + forceSelect parity so virtual URLs survive select/populated reads (target keys win)', () => {
    const m = (out.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    expect((m.defaultPopulate as Record<string, boolean>).src).toBe(true)
    expect((m.defaultPopulate as Record<string, boolean>).variants).toBeUndefined()
    expect((m.forceSelect as Record<string, boolean>).width).toBe(true)
    const opinionated: CollectionConfig = { ...media, defaultPopulate: { caption: true } as CollectionConfig['defaultPopulate'] }
    const kept = (run({ extendCollection: 'media' }, [opinionated]).collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    expect((kept.defaultPopulate as Record<string, boolean>).caption).toBe(true) // merged, never overwritten
    expect((kept.defaultPopulate as Record<string, boolean>).src).toBe(true)
  })

  it('adds the on-demand admin thumbnail only when the target has not set its own', () => {
    const m = (out.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    const thumb = (m.upload as { adminThumbnail?: (a: { doc: Record<string, unknown> }) => string | null }).adminThumbnail
    expect(thumb?.({ doc: { id: 'abc' } })).toBe('/api/img/abc?w=160&h=160&fit=cover&fmt=auto')
    const own: CollectionConfig = { ...media, upload: { adminThumbnail: 'card' } }
    const kept = (run({ extendCollection: 'media' }, [own]).collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    expect((kept.upload as { adminThumbnail?: unknown }).adminThumbnail).toBe('card')
  })

  it('throws a clear error for a missing or non-upload target', () => {
    expect(() => imagesPlugin({ extendCollection: 'nope' })(baseConfig([media]))).toThrow(/not found/)
    const pages: CollectionConfig = { slug: 'pages', fields: [] }
    expect(() => imagesPlugin({ extendCollection: 'pages' })(baseConfig([pages]))).toThrow(/not an upload/)
  })
})
