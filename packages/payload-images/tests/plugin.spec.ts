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
type PresetManagerProps = { prewarmPath?: string; presetsPath?: string; variantSlug?: string }
const presetManagerClientProps = (c: Config, slug = 'images'): PresetManagerProps | undefined => {
  const images = (c.collections ?? []).find((col) => col.slug === slug)
  const field = byName(images?.fields ?? [], 'presetManager') as
    | { admin?: { components?: { Field?: { clientProps?: PresetManagerProps } } } }
    | undefined
  return field?.admin?.components?.Field?.clientProps
}
/** The `variants` join on the source collection — its `collection` must track the variant-cache slug. */
const variantsJoinCollection = (c: Config, slug = 'images'): string | undefined => {
  const images = (c.collections ?? []).find((col) => col.slug === slug)
  return (byName(images?.fields ?? [], 'variants') as { collection?: string } | undefined)?.collection
}
type MarkerShape = { sourceSlug?: string; variantSlug?: string; prewarm?: { profilesSlug?: string } }

const imagesMarker = (c: Config): MarkerShape => (c.custom as { payloadImages: MarkerShape }).payloadImages

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

    expect(imagesOf(run({ collections: { images: { options: { folders: false } } } })).folders).toBeUndefined()

    const capped = imagesOf(run({ collections: { images: { options: { maxOriginalSize: 4096 } } } }))
    expect(capped.upload?.resizeOptions).toMatchObject({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
  })

  it('key-merges collections.images.overrides.forceSelect instead of replacing the plugin required select', () => {
    const images = (c: Config) =>
      (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig & { forceSelect?: Record<string, boolean> }
    const merged = images(run({ collections: { images: { overrides: { forceSelect: { credit: true } as CollectionConfig['forceSelect'] } } } }))
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
    const capped = (run({ options: { variantLimit: 50 } }).collections ?? []).find((c) => c.slug === 'images') as CollectionConfig
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
    const ladder = marker(run({ options: { prewarm: {}, pixelStep: [750, 220, 220, -5, 9999] } }))
    expect(ladder?.prewarm?.constraints?.widthLadder).toEqual([220, 750]) // sorted, deduped, bounds-checked
    expect(ladder?.prewarm?.constraints?.dimensionStep).toBe(50) // the grid stays at the default
    const grid = marker(run({ options: { prewarm: {}, pixelStep: 100 } }))
    expect(grid?.prewarm?.constraints?.dimensionStep).toBe(100)
    expect(grid?.prewarm?.constraints?.widthLadder).toBeUndefined()
  })

  it('collections.images.options.focalUI accepts an object form carrying the preview ratios', () => {
    const focalPreviewOf = (c: Config) => {
      const images = (c.collections ?? []).find((col) => col.slug === 'images') as CollectionConfig
      return byName(images.fields, 'focalPreview') as
        | { admin?: { components?: { Field?: { clientProps?: { previewRatios?: string[] } } } } }
        | undefined
    }
    expect(
      focalPreviewOf(run({ collections: { images: { options: { focalUI: { previewRatios: ['21:9'] } } } } }))?.admin?.components?.Field
        ?.clientProps?.previewRatios,
    ).toEqual(['21:9'])
    const images = (run({ collections: { images: { options: { focalUI: false } } } }).collections ?? []).find(
      (c) => c.slug === 'images',
    ) as CollectionConfig
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
    const out = run({ options: { prewarm: false } })
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
    const out = run({ options: { prewarm: {} } })
    const paths = (out.endpoints ?? []).map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/prewarm/:id', 'post /img/prewarm/:id']))
    expect(presetManagerClientProps(out)?.prewarmPath).toBe('/img/prewarm')
  })

  it('prewarm registers the registry collection, jobs task, bin script, hook, and marker', () => {
    const out = run({ options: { prewarm: {} } })
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
    expect(marker(run({ options: { prewarm: {}, transform: { preferAvif: true } } })).prewarm.formats).toEqual(['webp', 'avif'])

    const cron = { autoRun: '0 * * * *' }
    const fresh = run({ options: { prewarm: cron } })
    expect(fresh.jobs?.autoRun).toEqual([{ cron: '0 * * * *', queue: 'default', limit: 10 }])

    const withArray = imagesPlugin({ options: { prewarm: cron } })({
      ...baseConfig(),
      jobs: { autoRun: [{ cron: '* * * * *' }] },
    } as Config) as Config
    expect(withArray.jobs?.autoRun).toHaveLength(2)

    const fn = async () => [{ cron: '* * * * *' }]
    const withFn = imagesPlugin({ options: { prewarm: cron } })({ ...baseConfig(), jobs: { autoRun: fn } } as Config) as Config
    expect(typeof withFn.jobs?.autoRun).toBe('function')
    const composed = await (withFn.jobs?.autoRun as (p: unknown) => Promise<unknown[]>)({})
    expect(composed).toHaveLength(2)
  })
})

// Renaming replaces the deleted `extendCollection`: instead of pointing the plugin at an existing
// upload collection, you rename the one it registers and add your fields to it. The whole point is
// that the new slug reaches every internal reference — a rename that only changes `slug` would boot
// as `Field Variants has invalid relationship 'images'`.
describe('imagesPlugin — collections.images.slug (rename propagates to every internal reference)', () => {
  const out = run({ collections: { images: { slug: 'media', overrides: { fields: [{ name: 'credit', type: 'text' }] } } } })

  it('registers the collection under the new slug, and not the default one', () => {
    expect(slugs(out)).toEqual(expect.arrayContaining(['media', 'generated-images']))
    expect(slugs(out)).not.toContain('images')
  })

  it('repoints the variant cache `source` relationship at the new slug', () => {
    expect(variantSourceRelTo(out)).toBe('media')
  })

  it('repoints the marker at the new slug (bin scripts + imageFor read the source collection off it)', () => {
    expect(imagesMarker(out).sourceSlug).toBe('media')
    expect(imagesMarker(out).variantSlug).toBe('generated-images')
  })

  it('keeps the plugin surface on the renamed collection and appends the override fields', () => {
    const m = (out.collections ?? []).find((c) => c.slug === 'media') as CollectionConfig
    expect(byName(m.fields, 'variants')?.type).toBe('join')
    expect(variantsJoinCollection(out, 'media')).toBe('generated-images') // the join still finds the cache
    expect(byName(m.fields, 'alt')).toBeTruthy() // the plugin's own base field survives
    expect(byName(m.fields, 'credit')).toBeTruthy() // …and the override's field is appended
    expect((m.upload as { focalPoint?: boolean }).focalPoint).toBe(true)
    expect(m.hooks?.afterChange ?? []).not.toHaveLength(0)
    expect(m.hooks?.beforeDelete ?? []).not.toHaveLength(0)
    expect(presetManagerClientProps(out, 'media')?.prewarmPath).toBe('/img/prewarm')
  })
})

describe('imagesPlugin — collections.generatedImages.slug (the variant cache renames too)', () => {
  const out = run({ collections: { generatedImages: { slug: 'variant-cache' } } })

  it('registers the cache under the new slug and repoints the join + panel + marker at it', () => {
    expect(slugs(out)).toEqual(expect.arrayContaining(['images', 'variant-cache']))
    expect(slugs(out)).not.toContain('generated-images')
    expect(variantsJoinCollection(out)).toBe('variant-cache')
    expect(presetManagerClientProps(out)?.variantSlug).toBe('variant-cache') // the admin panel lists variants from it
    expect(imagesMarker(out).variantSlug).toBe('variant-cache')
    expect(variantSourceRelTo(out, 'variant-cache')).toBe('images') // …and it still points back at images
  })

  it('renames both at once and every cross-reference still resolves', () => {
    const both = run({ collections: { images: { slug: 'media' }, generatedImages: { slug: 'variant-cache' } } })
    expect(slugs(both)).toEqual(expect.arrayContaining(['media', 'variant-cache']))
    expect(variantSourceRelTo(both, 'variant-cache')).toBe('media')
    expect(variantsJoinCollection(both, 'media')).toBe('variant-cache')
    expect(presetManagerClientProps(both, 'media')?.variantSlug).toBe('variant-cache')
    expect(imagesMarker(both)).toMatchObject({ sourceSlug: 'media', variantSlug: 'variant-cache' })
  })
})

// The render-profiles collection is a table in your database, so it gets a `collections` key like
// any other. `prewarm` owns whether it exists at all — the key only shapes it.
describe('imagesPlugin — collections.renderProfiles (the prewarm registry is yours to shape too)', () => {
  it('renames it, and prewarm records its observations against the new slug', () => {
    const out = run({ collections: { renderProfiles: { slug: 'render-shapes' } } })
    expect(slugs(out)).toContain('render-shapes')
    expect(slugs(out)).not.toContain('image-render-profiles')
    expect(imagesMarker(out).prewarm?.profilesSlug).toBe('render-shapes')
  })

  it('merges an override onto it without touching what the plugin needs', () => {
    const out = run({
      collections: { renderProfiles: { overrides: { admin: { group: 'Diagnostics' }, fields: [{ name: 'note', type: 'text' }] } } },
    })
    const profiles = out.collections?.find((c) => c.slug === 'image-render-profiles')
    expect(profiles?.admin?.group).toBe('Diagnostics')
    const names = (profiles?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(names).toEqual(expect.arrayContaining(['profileKey', 'note'])) // the plugin's, then yours
  })

  it('is not registered when prewarm is off — prewarm owns its existence, not the key', () => {
    const out = run({ options: { prewarm: false }, collections: { renderProfiles: { slug: 'render-shapes' } } })
    expect(slugs(out)).not.toContain('render-shapes')
    expect(slugs(out)).not.toContain('image-render-profiles')
  })
})

describe('imagesPlugin — field collisions are a named boot error', () => {
  it('names the plugin, the collections key, and the colliding field', () => {
    const clash = (fields: CollectionConfig['fields']) => () =>
      imagesPlugin({ collections: { images: { overrides: { fields } } } })(baseConfig())
    expect(clash([{ name: 'placeholder', type: 'text' }])).toThrow(/\[payload-images\] collections\.images:.*placeholder/)
    // Nested inside a presentational row is the same data level — still a collision.
    expect(clash([{ type: 'row', fields: [{ name: 'palette', type: 'json' }] }])).toThrow(/\[payload-images\] collections\.images:.*palette/)
    expect(clash([{ name: 'credit', type: 'text' }])).not.toThrow()
  })

  it('guards the variant cache fields too', () => {
    const clash = () =>
      imagesPlugin({ collections: { generatedImages: { overrides: { fields: [{ name: 'cacheKey', type: 'text' }] } } } })(baseConfig())
    expect(clash).toThrow(/\[payload-images\] collections\.generatedImages:.*cacheKey/)
  })
})
