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
const presetManagerClientProps = (c: Config, slug = 'images'): { prewarmPath?: string; presetsPath?: string } | undefined => {
  const images = (c.collections ?? []).find((col) => col.slug === slug)
  const field = byName(images?.fields ?? [], 'presetManager') as
    | { admin?: { components?: { Field?: { clientProps?: { prewarmPath?: string; presetsPath?: string } } } } }
    | undefined
  return field?.admin?.components?.Field?.clientProps
}

describe('imagesPlugin — default (creates the images collection)', () => {
  const out = run()

  it('registers images + the hidden generated-images cache', () => {
    expect(slugs(out)).toEqual(expect.arrayContaining(['images', 'generated-images']))
  })

  it('points the variant cache `source` at images', () => {
    expect(variantSourceRelTo(out)).toBe('images')
  })

  it('registers the transform + purge + preset-status endpoints', () => {
    const paths = (out.endpoints ?? []).map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/:id', 'post /img/purge/:id', 'get /img/presets/:id']))
    expect(presetManagerClientProps(out)?.presetsPath).toBe('/img/presets')
  })

  it('stashes the resolved config on config.custom for external tooling', () => {
    const stash = (out.custom as { payloadImages?: { sourceSlug?: string; variantSlug?: string } }).payloadImages
    expect(stash?.sourceSlug).toBe('images')
    expect(stash?.variantSlug).toBe('generated-images')
  })

  // Folders are on by default (a managed library organizes itself); maxOriginalSize stays unset so
  // originals are kept at full quality.
  it('enables folders by default and leaves originals untouched unless maxOriginalSize is set', () => {
    const imagesOf = (c: Config) =>
      (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig & {
        folders?: unknown
        upload?: { resizeOptions?: { width?: number; height?: number; fit?: string; withoutEnlargement?: boolean } }
      }

    const def = imagesOf(out)
    expect(def.folders).toBe(true)
    expect(def.upload?.resizeOptions).toBeUndefined() // original kept untouched

    expect(imagesOf(run({ admin: { folders: false } })).folders).toBeUndefined()

    const capped = imagesOf(run({ maxOriginalSize: 4096 }))
    expect(capped.upload?.resizeOptions).toMatchObject({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
  })

  it('key-merges collections.images.forceSelect instead of replacing the plugin required select', () => {
    const images = (c: Config) =>
      (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig & { forceSelect?: Record<string, boolean> }
    const merged = images(run({ collections: { images: { forceSelect: { credit: true } as CollectionConfig['forceSelect'] } } }))
    expect(merged.forceSelect?.credit).toBe(true) // the override key is added…
    expect(merged.forceSelect?.width).toBe(true) // …without dropping the plugin's virtual-field inputs
  })

  // forceSelect keeps the virtual fields' inputs present even under an explicit `select`;
  // defaultPopulate stays the lean RESPONSIVE_IMAGE_SELECT (identity fields are a select away).
  it('forces the crop/version inputs so the placeholder virtual always has them', () => {
    const images = (run({}).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig & {
      forceSelect?: Record<string, boolean>
      defaultPopulate?: Record<string, boolean>
    }
    expect(images.forceSelect?.width).toBe(true)
    expect(images.forceSelect?.filename).toBe(true)
    expect(images.forceSelect?.focalX).toBe(true)
    expect(images.defaultPopulate?.src).toBe(true)
    expect(images.defaultPopulate?.width).toBeUndefined()
  })

  it('adds the presets + variantLimit fields (default cap 200) and the preset-generation hook', () => {
    const images = (out.collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    const variantLimit = byName(images.fields, 'variantLimit') as { defaultValue?: number } | undefined
    expect(variantLimit?.defaultValue).toBe(200)
    expect(byName(images.fields, 'presets')).toBeTruthy()
    expect(byName(images.fields, 'presetManager')).toBeTruthy() // the admin ui field
    expect(images.hooks?.afterChange).toHaveLength(3) // purge + prewarm enqueue + preset generation
    // A custom cap default threads through:
    const capped = (run({ variantLimit: 50 }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect((byName(capped.fields, 'variantLimit') as { defaultValue?: number }).defaultValue).toBe(50)
  })

  it('registers nothing when enabled is false', () => {
    const off = run({ enabled: false })
    expect(off.collections ?? []).toHaveLength(0)
    expect(off.endpoints ?? []).toHaveLength(0)
  })

  // The transform endpoint is the plugin — there is no mode that registers the collections without
  // it, so the virtual URLs and the variant surface are unconditional.
  it('always registers the transform surface (virtual URLs, purge button, variants join)', () => {
    const images = (run({}).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect(byName(images.fields, 'src')).toBeTruthy()
    expect(byName(images.fields, 'variants')).toBeTruthy()
    expect(byName(images.fields, 'focalPreview')).toBeTruthy()
  })

  it('folds an array pixelStep into the snap width ladder (sanitized) instead of the grid', () => {
    const marker = (out: Config) =>
      (out.custom as { payloadImages?: { prewarm?: { constraints?: { dimensionStep?: number; widthLadder?: number[] } } } }).payloadImages
    const ladder = marker(run({ prewarm: {}, pixelStep: [750, 220, 220, -5, 9999] }))
    expect(ladder?.prewarm?.constraints?.widthLadder).toEqual([220, 750]) // sorted, deduped, bounds-checked
    expect(ladder?.prewarm?.constraints?.dimensionStep).toBe(50) // the grid stays at the default
    const grid = marker(run({ prewarm: {}, pixelStep: 100 }))
    expect(grid?.prewarm?.constraints?.dimensionStep).toBe(100)
    expect(grid?.prewarm?.constraints?.widthLadder).toBeUndefined()
  })

  it('admin.focalUI accepts an object form carrying the preview ratios', () => {
    const focalPreviewOf = (c: Config) => {
      const images = (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig
      return byName(images.fields, 'focalPreview') as
        | { admin?: { components?: { Field?: { clientProps?: { previewRatios?: string[] } } } } }
        | undefined
    }
    expect(
      focalPreviewOf(run({ admin: { focalUI: { previewRatios: ['21:9'] } } }))?.admin?.components?.Field?.clientProps?.previewRatios,
    ).toEqual(['21:9'])
    const images = (run({ admin: { focalUI: false } }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
    expect(byName(images.fields, 'focalPreview')).toBeUndefined()
  })
})

describe('imagesPlugin — prewarm (on by default, `prewarm: false` opts out of the whole surface)', () => {
  it('is on by default: registers the registry collection, jobs task, bin script, endpoints, and marker', () => {
    const out = run()
    expect(slugs(out)).toContain('image-render-profiles')
    expect((out.jobs?.tasks ?? []).map((t) => (t as { slug?: string }).slug)).toContain('imagesPrewarm')
    expect((out.bin ?? []).map((b) => b.key)).toContain('images:prewarm')
    const marker = (out.custom as { payloadImages?: { prewarm?: unknown } }).payloadImages
    expect(marker?.prewarm).toBeDefined()
    const paths = (out.endpoints ?? []).map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/prewarm/:id', 'post /img/prewarm/:id']))
    expect(presetManagerClientProps(out)?.prewarmPath).toBe('/img/prewarm')
  })

  it('prewarm: false registers nothing prewarm-related — the opt-out escape hatch', () => {
    const out = run({ prewarm: false })
    expect(slugs(out)).not.toContain('image-render-profiles')
    expect(out.jobs).toBeUndefined()
    expect((out.bin ?? []).map((b) => b.key)).not.toContain('images:prewarm')
    const marker = (out.custom as { payloadImages?: { prewarm?: unknown } }).payloadImages
    expect(marker?.prewarm).toBeUndefined()
    const paths = (out.endpoints ?? []).map((e) => `${e.method} ${e.path}`)
    expect(paths).not.toContain('get /img/prewarm/:id')
    expect(paths).not.toContain('post /img/prewarm/:id')
    expect(presetManagerClientProps(out)?.prewarmPath).toBeUndefined()
  })

  it('prewarm registers the status + trigger endpoints and hands the panel the path', () => {
    const out = run({ prewarm: {} })
    const paths = (out.endpoints ?? []).map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/prewarm/:id', 'post /img/prewarm/:id']))
    expect(presetManagerClientProps(out)?.prewarmPath).toBe('/img/prewarm')
  })

  it('prewarm registers the registry collection, jobs task, bin script, hook, and marker', () => {
    const out = run({ prewarm: {} })
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
    expect(marker(run({ prewarm: {}, transform: { preferAvif: true } })).prewarm.formats).toEqual(['webp', 'avif'])

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

  it('hands the extended target the prewarm panel path (on by default; gone only when prewarm: false)', () => {
    const warmed = run({ extendCollection: 'media', prewarm: {} }, [media])
    expect(presetManagerClientProps(warmed, 'media')?.prewarmPath).toBe('/img/prewarm')
    expect(presetManagerClientProps(out, 'media')?.prewarmPath).toBe('/img/prewarm') // default run — prewarm is on
    const off = run({ extendCollection: 'media', prewarm: false }, [media])
    expect(presetManagerClientProps(off, 'media')?.prewarmPath).toBeUndefined()
  })

  it('applies folders to the extended target by default, and honors an opt-out', () => {
    const m = (out.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig & { folders?: unknown }
    expect(m.folders).toBe(true)
    const off = run({ extendCollection: 'media', admin: { folders: false } }, [media])
    const noFolders = (off.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig & { folders?: unknown }
    expect(noFolders.folders).toBeUndefined()
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
    expect(thumb?.({ doc: { id: 'abc' } })).toBe('/api/img/abc?preset=thumbnail')
    const own: CollectionConfig = { ...media, upload: { adminThumbnail: 'card' } }
    const kept = (run({ extendCollection: 'media' }, [own]).collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    expect((kept.upload as { adminThumbnail?: unknown }).adminThumbnail).toBe('card')
  })

  it('throws a clear error for a missing or non-upload target', () => {
    expect(() => imagesPlugin({ extendCollection: 'nope' })(baseConfig([media]))).toThrow(/not found/)
    const pages: CollectionConfig = { slug: 'pages', fields: [] }
    expect(() => imagesPlugin({ extendCollection: 'pages' })(baseConfig([pages]))).toThrow(/not an upload/)
  })

  it('throws a plugin-attributed error when the target already defines an injected field name', () => {
    const clashing: CollectionConfig = { ...media, fields: [...media.fields, { name: 'placeholder', type: 'text' }] }
    expect(() => imagesPlugin({ extendCollection: 'media' })(baseConfig([clashing]))).toThrow(/payload-images.*placeholder/)
    // Nested inside a presentational row is the same data level — still a collision.
    const rowClash: CollectionConfig = { ...media, fields: [{ type: 'row', fields: [{ name: 'palette', type: 'json' }] }] }
    expect(() => imagesPlugin({ extendCollection: 'media' })(baseConfig([rowClash]))).toThrow(/payload-images.*palette/)
  })
})

describe('imagesPlugin — override slug safety', () => {
  // `slug` is Omit-ed from both override types, so this is a type error for callers; the runtime
  // guard still has to hold for JS consumers and `as`-casts, hence the cast on the way IN only.
  it('ignores a slug in collections.images / collections.generatedImages (internal references stay bound)', () => {
    const out = run({
      collections: {
        images: { slug: 'renamed-images' } as Omit<Partial<CollectionConfig>, 'slug'>,
        generatedImages: { slug: 'renamed-variants' } as Omit<Partial<CollectionConfig>, 'slug'>,
      },
    })
    expect(slugs(out)).toEqual(expect.arrayContaining(['images', 'generated-images']))
    expect(slugs(out)).not.toContain('renamed-variants')
    expect(slugs(out)).not.toContain('renamed-images')
  })
})
