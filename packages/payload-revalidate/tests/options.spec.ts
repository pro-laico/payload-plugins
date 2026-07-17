import type { CollectionConfig, GlobalConfig } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { globalEnabled, resolveCollectionSettings, resolveOptions } from '../src/options'

const posts = (
  custom?: CollectionConfig['custom'],
  fields: CollectionConfig['fields'] = [{ name: 'slug', type: 'text' }],
): CollectionConfig => ({
  slug: 'posts',
  fields,
  custom,
})

describe('resolveOptions', () => {
  it('applies defaults', () => {
    expect(resolveOptions()).toMatchObject({ enabled: true, collections: {}, globals: {}, options: { prefix: '', rules: [] } })
  })

  it('keeps explicit values', () => {
    const resolved = resolveOptions({ enabled: false, options: { prefix: 'shop', observe: true } })
    expect(resolved).toMatchObject({ enabled: false, options: { prefix: 'shop', observe: true } })
  })
})

describe('resolveCollectionSettings', () => {
  it('defaults idField to slug when the collection has a slug field, false otherwise', () => {
    const withSlug = resolveCollectionSettings(posts(), resolveOptions())
    expect(withSlug).toEqual({ idField: 'slug', lists: {}, extraTags: [] })
    const withoutSlug = resolveCollectionSettings(posts(undefined, [{ name: 'title', type: 'text' }]), resolveOptions())
    expect(withoutSlug?.idField).toBe(false)
  })

  it('normalizes declared list scopes to scope → fields, accepting the string[] shorthand and the { fields } form', () => {
    const resolved = resolveOptions({
      collections: { posts: { lists: { recent: ['publishedAt'], featured: { fields: ['featured', 'publishedAt'] } } } },
    })
    expect(resolveCollectionSettings(posts(), resolved)?.lists).toEqual({ recent: ['publishedAt'], featured: ['featured', 'publishedAt'] })
  })

  it('finds the slug field through presentational wrappers but not named tabs', () => {
    const inRow = posts(undefined, [{ type: 'row', fields: [{ name: 'slug', type: 'text' }] }])
    expect(resolveCollectionSettings(inRow, resolveOptions())?.idField).toBe('slug')
    const inNamedTab = posts(undefined, [{ type: 'tabs', tabs: [{ name: 'meta', fields: [{ name: 'slug', type: 'text' }] }] }])
    expect(resolveCollectionSettings(inNamedTab, resolveOptions())?.idField).toBe(false)
  })

  it('reads the custom.revalidate marker and lets plugin options win field by field', () => {
    const marked = posts({ revalidate: { lists: { recent: { fields: ['title'] } }, extraTags: ['sitemap'] } })
    expect(resolveCollectionSettings(marked, resolveOptions())).toEqual({
      idField: 'slug',
      lists: { recent: ['title'] },
      extraTags: ['sitemap'],
    })
    const overridden = resolveCollectionSettings(
      marked,
      resolveOptions({ collections: { posts: { lists: { featured: { fields: ['featured'] } } } } }),
    )
    expect(overridden).toEqual({ idField: 'slug', lists: { featured: ['featured'] }, extraTags: ['sitemap'] })
  })

  it('opts out via options false, marker false, and lets an options object override a marker false', () => {
    expect(resolveCollectionSettings(posts(), resolveOptions({ collections: { posts: false } }))).toBeNull()
    expect(resolveCollectionSettings(posts({ revalidate: false }), resolveOptions())).toBeNull()
    expect(resolveCollectionSettings(posts({ revalidate: false }), resolveOptions({ collections: { posts: {} } }))).not.toBeNull()
  })

  it('honors an explicit idField: false', () => {
    expect(resolveCollectionSettings(posts({ revalidate: { idField: false } }), resolveOptions())?.idField).toBe(false)
  })

  it('drops malformed marker pieces with a warning instead of letting them crash the hooks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // Markers are authored by third-party packages WITHOUT types — every wrong shape
      // must degrade to "ignored", never reach `anyChanged(changed, undefined)` at save time.
      const malformed = resolveCollectionSettings(
        posts({
          revalidate: {
            lists: { recent: [42], ok: { fields: ['order'] }, alsoBad: { fields: 'order' } },
            extraTags: 'sitemap',
            idField: 42,
          } as never,
        }),
        resolveOptions(),
      )
      expect(malformed).toEqual({ idField: 'slug', lists: { ok: ['order'] }, extraTags: [] })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('lists.recent'))
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('extraTags'))
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('idField'))

      const listsNotObject = resolveCollectionSettings(posts({ revalidate: { lists: ['recent'] } as never }), resolveOptions())
      expect(listsNotObject?.lists).toEqual({})
    } finally {
      warn.mockRestore()
    }
  })
})

describe('globalEnabled', () => {
  const header: GlobalConfig = { slug: 'header', fields: [] }

  it('defaults on, opts out via options or marker', () => {
    expect(globalEnabled(header, resolveOptions())).toBe(true)
    expect(globalEnabled(header, resolveOptions({ globals: { header: false } }))).toBe(false)
    expect(globalEnabled({ ...header, custom: { revalidate: false } }, resolveOptions())).toBe(false)
  })
})
