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

  it('key-merges imagesOverrides.forceSelect instead of replacing the plugin required select', () => {
    const images = (c: Config) =>
      (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig & { forceSelect?: Record<string, boolean> }
    const merged = images(run({ imagesOverrides: { forceSelect: { credit: true } as CollectionConfig['forceSelect'] } }))
    expect(merged.forceSelect?.credit).toBe(true) // the override key is added…
    expect(merged.forceSelect?.width).toBe(true) // …without dropping the plugin's virtual-field inputs
  })

  it('forces the crop/version inputs even with virtualFields: false (build-URLs-yourself mode)', () => {
    const images = (run({ virtualFields: false }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig & {
      forceSelect?: Record<string, boolean>
      defaultPopulate?: Record<string, boolean>
    }
    expect(images.forceSelect?.width).toBe(true)
    expect(images.forceSelect?.filename).toBe(true)
    expect(images.forceSelect?.focalX).toBe(true)
    expect(images.defaultPopulate?.width).toBe(true) // populated docs carry the identity fields too
    expect(images.defaultPopulate?.filename).toBe(true)
  })

  it('adds the presets + variantLimit fields (default cap 200) and the preset-generation hook', () => {
    const images = (out.collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    const variantLimit = byName(images.fields, 'variantLimit') as { defaultValue?: number } | undefined
    expect(variantLimit?.defaultValue).toBe(200)
    expect(byName(images.fields, 'presets')).toBeTruthy()
    expect(byName(images.fields, 'presetManager')).toBeTruthy() // the admin ui field
    expect(images.hooks?.afterChange).toHaveLength(2) // purge + preset generation (no prewarm)
    // A custom cap default threads through:
    const capped = (run({ variantLimit: 50 }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect((byName(capped.fields, 'variantLimit') as { defaultValue?: number }).defaultValue).toBe(50)
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

  it('folds an array pixelStep into the snap width ladder (sanitized) instead of the grid', () => {
    const marker = (out: Config) =>
      (out.custom as { payloadImages?: { prewarm?: { constraints?: { dimensionStep?: number; widthLadder?: number[] } } } }).payloadImages
    const ladder = marker(run({ prewarm: true, pixelStep: [750, 220, 220, -5, 9999] }))
    expect(ladder?.prewarm?.constraints?.widthLadder).toEqual([220, 750]) // sorted, deduped, bounds-checked
    expect(ladder?.prewarm?.constraints?.dimensionStep).toBe(50) // the grid stays at the default
    const grid = marker(run({ prewarm: true, pixelStep: 100 }))
    expect(grid?.prewarm?.constraints?.dimensionStep).toBe(100)
    expect(grid?.prewarm?.constraints?.widthLadder).toBeUndefined()
  })

  it('focalUI accepts an object form carrying the preview ratios', () => {
    const focalPreviewOf = (c: Config) => {
      const images = (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig
      return byName(images.fields, 'focalPreview') as
        | { admin?: { components?: { Field?: { clientProps?: { previewRatios?: string[] } } } } }
        | undefined
    }
    expect(focalPreviewOf(run({ focalUI: { previewRatios: ['21:9'] } }))?.admin?.components?.Field?.clientProps?.previewRatios).toEqual([
      '21:9',
    ])
    const images = (run({ focalUI: false }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect(byName(images.fields, 'focalPreview')).toBeUndefined()
  })
})

describe('imagesPlugin — prewarm (default off, opt-in registers the whole surface)', () => {
  it('registers nothing prewarm-related by default', () => {
    const out = run()
    expect(slugs(out)).not.toContain('image-render-profiles')
    expect(out.jobs).toBeUndefined()
    expect((out.bin ?? []).map((b) => b.key)).not.toContain('images:prewarm')
    const marker = (out.custom as { payloadImages?: { prewarm?: unknown } }).payloadImages
    expect(marker?.prewarm).toBeUndefined()
  })

  it('prewarm: true registers the registry collection, jobs task, bin script, hook, and marker', () => {
    const out = run({ prewarm: true })
    expect(slugs(out)).toContain('image-render-profiles')
    expect((out.jobs?.tasks ?? []).map((t) => (t as { slug?: string }).slug)).toContain('imagesPrewarm')
    expect((out.bin ?? []).map((b) => b.key)).toContain('images:prewarm')
    const images = (out.collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect(images.hooks?.afterChange).toHaveLength(3) // purge + prewarm enqueue + preset generation
    const marker = (
      out.custom as { payloadImages?: { prewarm?: { taskSlug?: string; formats?: string[]; constraints?: { dimensionStep?: number } } } }
    ).payloadImages
    expect(marker?.prewarm?.taskSlug).toBe('imagesPrewarm')
    expect(marker?.prewarm?.formats).toEqual(['webp'])
    expect(marker?.prewarm?.constraints?.dimensionStep).toBe(50)
    expect(out.jobs?.autoRun).toBeUndefined() // no forced background work
  })

  it('derives avif from transform.preferAvif and composes autoRun over existing shapes', async () => {
    const marker = (c: Config) => (c.custom as { payloadImages: { prewarm: { formats: string[] } } }).payloadImages
    expect(marker(run({ prewarm: true, transform: { preferAvif: true } })).prewarm.formats).toEqual(['webp', 'avif'])

    const cron = { autoRun: '0 * * * *' }
    const fresh = run({ prewarm: cron })
    expect(fresh.jobs?.autoRun).toEqual([{ cron: '0 * * * *', queue: 'default', limit: 10 }])

    const withArray = imagesPlugin({ prewarm: cron })({ ...baseConfig(), jobs: { autoRun: [{ cron: '* * * * *' }] } } as Config) as Config
    expect(withArray.jobs?.autoRun).toHaveLength(2)

    const fn = async () => [{ cron: '* * * * *' }]
    const withFn = imagesPlugin({ prewarm: cron })({ ...baseConfig(), jobs: { autoRun: fn } } as Config) as Config
    expect(typeof withFn.jobs?.autoRun).toBe('function')
    const composed = await (withFn.jobs?.autoRun as (p: unknown) => Promise<unknown[]>)({})
    expect(composed).toHaveLength(2)
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
