import type { CollectionConfig, Config, TextField } from 'payload'
import { describe, expect, it } from 'vitest'
import { iconsPlugin } from '../src/plugin'
import type { PayloadIconsMarker } from '../src/types'

const run = (options: Parameters<typeof iconsPlugin>[0] = {}, collections: CollectionConfig[] = []): Config =>
  iconsPlugin(options)({ collections } as Config) as Config

const slugs = (c: Config): string[] => (c.collections ?? []).map((col) => col.slug)
const markerOf = (c: Config): PayloadIconsMarker | undefined => (c.custom as { payloadIcons?: PayloadIconsMarker }).payloadIcons
const collectionOf = (c: Config, slug: string): CollectionConfig => (c.collections ?? []).find((col) => col.slug === slug) as CollectionConfig
// Fields live inside tabs/rows on iconSet, so search the whole tree.
const byName = (fields: CollectionConfig['fields'], name: string): unknown =>
  fields
    .flatMap((f): unknown[] => {
      if ('name' in f && f.name === name) return [f]
      if ('fields' in f && Array.isArray(f.fields)) return [byName(f.fields, name)]
      if (f.type === 'tabs') return f.tabs.map((t) => byName(t.fields, name))
      return []
    })
    .filter(Boolean)[0]

describe('iconsPlugin', () => {
  it('registers icon, iconSet, and iconRequest by default', () => {
    expect(slugs(run())).toEqual(['icon', 'iconSet', 'iconRequest'])
  })

  it('is a no-op when disabled', () => {
    const config = { collections: [] } as unknown as Config
    expect(iconsPlugin({ enabled: false })(config)).toBe(config)
  })

  it('preserves existing collections', () => {
    const posts: CollectionConfig = { slug: 'posts', fields: [] }
    expect(slugs(run({}, [posts]))).toEqual(['posts', 'icon', 'iconSet', 'iconRequest'])
  })

  // `collections.<role>: false` is the single axis for "don't register this" — it replaces the old
  // includeIconSet / trackRequests booleans that paired with a separate overrides key.
  it('collections.iconSet: false skips the set collection and nulls its marker slug', () => {
    const out = run({ collections: { iconSet: false } })
    expect(slugs(out)).toEqual(['icon', 'iconRequest'])
    expect(markerOf(out)?.iconSetSlug).toBeNull()
  })

  it('collections.iconRequest: false skips the collection and its clear endpoint', () => {
    const out = run({ collections: { iconRequest: false } })
    expect(slugs(out)).toEqual(['icon', 'iconSet'])
    expect(out.endpoints ?? []).toHaveLength(0)
    expect(markerOf(out)?.iconRequestSlug).toBeNull()
  })

  it('registers the clear-requests endpoint when tracking is on', () => {
    expect((run().endpoints ?? []).map((e) => `${e.method} ${e.path}`)).toEqual(['delete /payload-icons/icon-requests'])
  })

  it('collections.iconSet.options.usagePanel: false drops the usage field from the set', () => {
    expect(byName(collectionOf(run(), 'iconSet').fields, 'iconUsage')).toBeTruthy()
    const off = run({ collections: { iconSet: { options: { usagePanel: false } } } })
    expect(byName(collectionOf(off, 'iconSet').fields, 'iconUsage')).toBeUndefined()
  })

  it('collections.iconSet.options.iconRowFields are appended to each iconsArray row, after the built-in name + upload', () => {
    const aliases: TextField = { name: 'aliases', type: 'text', hasMany: true }
    const set = collectionOf(run({ collections: { iconSet: { options: { iconRowFields: [aliases] } } } }), 'iconSet')
    expect(byName(set.fields, 'aliases')).toEqual(aliases)
  })

  it('writes the marker and preserves existing custom entries', () => {
    const out = iconsPlugin({})({ collections: [], custom: { other: 1 } } as Partial<Config> as Config) as Config
    expect(out.custom).toMatchObject({ other: 1, payloadIcons: { iconSlug: 'icon', iconSetSlug: 'iconSet', iconRequestSlug: 'iconRequest' } })
  })
})

// One override contract — `overrides: Partial<CollectionConfig>` — merged by the vendored kit. The
// old bespoke allowlist accepted only a hand-picked handful of keys; anything Payload has is
// overridable now.
describe('collections.<role>.overrides', () => {
  it('accepts keys the old allowlist forbade — labels, defaultPopulate, versions, defaultSort', () => {
    const out = run({
      collections: {
        icon: {
          overrides: { labels: { singular: 'Glyph', plural: 'Glyphs' }, defaultPopulate: { filename: true }, defaultSort: '-updatedAt' },
        },
        iconSet: { overrides: { versions: false } },
      },
    })
    const icon = collectionOf(out, 'icon')
    expect(icon.labels).toEqual({ singular: 'Glyph', plural: 'Glyphs' })
    expect(icon.defaultSort).toBe('-updatedAt')
    expect(icon.defaultPopulate).toEqual({ filename: true })
    expect(collectionOf(out, 'iconSet').versions).toBe(false)
  })

  it('shallow-merges access and admin, keeping the plugin defaults you did not touch', () => {
    const readAll = () => true
    const icon = collectionOf(
      run({ collections: { icon: { overrides: { admin: { group: 'Branding' }, access: { read: readAll } } } } }),
      'icon',
    )
    expect(icon.admin?.group).toBe('Branding')
    expect(icon.admin?.useAsTitle).toBe('filename')
    expect(icon.access?.read).toBe(readAll)
    expect(icon.access?.create).toBeTypeOf('function')
  })

  it('shallow-merges upload, keeping the SVG mime-type gate', () => {
    const icon = collectionOf(run({ collections: { icon: { overrides: { upload: { staticDir: 'public/icons' } } } } }), 'icon')
    expect(icon.upload).toMatchObject({ staticDir: 'public/icons', mimeTypes: ['image/svg+xml'], allowRestrictedFileTypes: true })
  })

  it('appends your fields after the plugin’s', () => {
    const note: TextField = { name: 'note', type: 'text' }
    const icon = collectionOf(run({ collections: { icon: { overrides: { fields: [note] } } } }), 'icon')
    expect(icon.fields.map((f) => ('name' in f ? f.name : f.type))).toEqual(['iconPreview', 'optimized', 'svgString', 'note'])
  })

  it('merges hooks per phase — yours run after the plugin’s', () => {
    const mine = () => undefined
    const icon = collectionOf(run({ collections: { icon: { overrides: { hooks: { beforeChange: [mine] } } } } }), 'icon')
    expect(icon.hooks?.beforeChange).toHaveLength(2)
    expect(icon.hooks?.beforeChange?.[1]).toBe(mine)
  })

  it('a field named like one the plugin injects is a named boot error, not a bare DuplicateFieldName', () => {
    const clash: TextField = { name: 'svgString', type: 'text' }
    expect(() => run({ collections: { icon: { overrides: { fields: [clash] } } } })).toThrow(
      '[payload-icons] collections.icon: field(s) svgString are already defined by the plugin — rename or remove them.',
    )
  })

  // The error names the `collections` KEY, not the slug — it's telling you where to go and edit,
  // and `collections.glyphSet` is not a key that exists in anyone's config.
  it('names the option key in the collision error, even when the collection is renamed', () => {
    const clash: TextField = { name: 'title', type: 'text' }
    expect(() => run({ collections: { iconSet: { slug: 'glyphSet', overrides: { fields: [clash] } } } })).toThrow(
      /collections\.iconSet: field\(s\) title/,
    )
  })
})

// mergeCollection honours `override.slug`, so a rename has to reach every internal reference: the
// set's upload field, the marker, and the endpoint the clear button calls.
describe('slug threading', () => {
  it('threads a renamed icon slug into the set’s upload field and the marker', () => {
    const out = run({ collections: { icon: { slug: 'glyph' } } })
    expect(slugs(out)).toEqual(['glyph', 'iconSet', 'iconRequest'])
    expect(markerOf(out)?.iconSlug).toBe('glyph')
    expect(byName(collectionOf(out, 'iconSet').fields, 'icon')).toMatchObject({ relationTo: 'glyph' })
  })

  it('threads a renamed iconSet slug into the marker', () => {
    const out = run({ collections: { iconSet: { slug: 'glyphSet' } } })
    expect(slugs(out)).toEqual(['icon', 'glyphSet', 'iconRequest'])
    expect(markerOf(out)?.iconSetSlug).toBe('glyphSet')
  })

  it('threads a renamed iconRequest slug into the marker and the clear endpoint', () => {
    const out = run({ collections: { iconRequest: { slug: 'glyphRequest' } } })
    expect(slugs(out)).toEqual(['icon', 'iconSet', 'glyphRequest'])
    expect(markerOf(out)?.iconRequestSlug).toBe('glyphRequest')
    expect(out.endpoints ?? []).toHaveLength(1)
  })

  it('renames every collection at once', () => {
    const out = run({ collections: { icon: { slug: 'glyph' }, iconSet: { slug: 'glyphSet' }, iconRequest: { slug: 'glyphRequest' } } })
    expect(slugs(out)).toEqual(['glyph', 'glyphSet', 'glyphRequest'])
    expect(markerOf(out)).toMatchObject({ iconSlug: 'glyph', iconSetSlug: 'glyphSet', iconRequestSlug: 'glyphRequest' })
    expect(byName(collectionOf(out, 'glyphSet').fields, 'icon')).toMatchObject({ relationTo: 'glyph' })
  })
})
