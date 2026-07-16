import type { CollectionConfig, Config } from 'payload'
import { describe, expect, it } from 'vitest'
import { iconsPlugin } from '../src/plugin'
import type { PayloadIconsMarker } from '../src/types'

const run = (options: Parameters<typeof iconsPlugin>[0] = {}, collections: CollectionConfig[] = []): Config =>
  iconsPlugin(options)({ collections } as Config) as Config

const slugs = (c: Config): string[] => (c.collections ?? []).map((col) => col.slug)
const markerOf = (c: Config): PayloadIconsMarker | undefined => (c.custom as { payloadIcons?: PayloadIconsMarker }).payloadIcons
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

  it('applies collections.icon overrides and threads the resolved slug into the set + marker', () => {
    const out = run({ collections: { icon: { slug: 'glyph' } } })
    expect(slugs(out)).toContain('glyph')
    expect(markerOf(out)?.iconSlug).toBe('glyph')
  })

  it('applies collections.iconSet overrides', () => {
    const out = run({ collections: { iconSet: { slug: 'glyphSet', group: 'Branding' } } })
    expect(slugs(out)).toContain('glyphSet')
    expect(markerOf(out)?.iconSetSlug).toBe('glyphSet')
  })

  it('admin.usagePanel: false drops the usage field from the set', () => {
    const setOf = (c: Config) => (c.collections ?? []).find((col) => col.slug === 'iconSet') as CollectionConfig
    expect(byName(setOf(run()).fields, 'iconUsage')).toBeTruthy()
    expect(byName(setOf(run({ admin: { usagePanel: false } })).fields, 'iconUsage')).toBeUndefined()
  })

  it('writes the marker and preserves existing custom entries', () => {
    const out = iconsPlugin({})({ collections: [], custom: { other: 1 } } as Partial<Config> as Config) as Config
    expect(out.custom).toMatchObject({ other: 1, payloadIcons: { iconSlug: 'icon', iconSetSlug: 'iconSet', iconRequestSlug: 'iconRequest' } })
  })
})
