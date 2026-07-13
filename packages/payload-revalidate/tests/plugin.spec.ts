import type { CollectionConfig, Config, Endpoint } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { getInspection } from '../src/lib/inspect'
import { revalidatePlugin } from '../src/plugin'
import { getState } from '../src/lib/state'

const posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'slug', type: 'text' },
    { name: 'hero', type: 'upload', relationTo: 'media' },
  ],
}

const apply = (config: Partial<Config> = {}, options: Parameters<typeof revalidatePlugin>[0] = {}): Config =>
  revalidatePlugin({ observe: false, ...options })(config as Config) as Config

describe('revalidatePlugin', () => {
  it('appends hooks to every collection and global without dropping existing ones', () => {
    const existing = vi.fn()
    const config = apply({
      collections: [{ ...posts, hooks: { afterChange: [existing] } }],
      globals: [{ slug: 'header', fields: [] }],
    })
    expect(config.collections?.[0]?.hooks?.afterChange).toHaveLength(2)
    expect(config.collections?.[0]?.hooks?.afterChange?.[0]).toBe(existing)
    expect(config.collections?.[0]?.hooks?.afterDelete).toHaveLength(1)
    expect(config.globals?.[0]?.hooks?.afterChange).toHaveLength(1)
  })

  it('skips opted-out collections and globals (options or custom.revalidate marker)', () => {
    const config = apply(
      {
        collections: [posts, { slug: 'internal', fields: [], custom: { revalidate: false } }],
        globals: [{ slug: 'header', fields: [] }],
      },
      { collections: { posts: false }, globals: { header: false } },
    )
    expect(config.collections?.[0]?.hooks?.afterChange).toBeUndefined()
    expect(config.collections?.[1]?.hooks?.afterChange).toBeUndefined()
    expect(config.globals?.[0]?.hooks?.afterChange).toBeUndefined()
  })

  it('registers the map endpoints (both methods) and preserves existing endpoints', () => {
    const existing: Endpoint = { path: '/mine', method: 'get', handler: async () => new Response(null) }
    const endpoints = apply({ endpoints: [existing] }).endpoints ?? []
    expect(endpoints.map((e) => `${e.method} ${e.path}`)).toEqual(['get /mine', 'get /revalidate-map', 'post /revalidate-map'])
    expect(apply({}, { endpoint: false }).endpoints ?? []).toHaveLength(0)
  })

  it('registers the revalidate-map bin command and preserves existing bin entries', () => {
    const bin = apply({ bin: [{ key: 'mine', scriptPath: '/mine.js' }] }).bin ?? []
    expect(bin.map((b) => b.key)).toEqual(['mine', 'revalidate-map'])
    expect(bin.find((b) => b.key === 'revalidate-map')?.scriptPath).toMatch(/bin[/\\]revalidateMap\.(ts|js)$/)
  })

  it('writes the custom.payloadRevalidate marker and preserves existing custom entries', () => {
    const config = apply({ custom: { other: 1 } })
    expect(config.custom).toMatchObject({ other: 1, payloadRevalidate: { endpointPath: '/api/revalidate-map' } })
    expect(apply({}, { endpoint: false }).custom).toMatchObject({ payloadRevalidate: { endpointPath: null } })
  })

  it('is a no-op when disabled', () => {
    const config: Partial<Config> = { collections: [posts] }
    expect(apply(config, { enabled: false })).toBe(config)
  })

  it("wraps onInit without dropping the app's own onInit", async () => {
    const appOnInit = vi.fn()
    const config = apply({ onInit: appOnInit })
    await config.onInit?.({ config: { collections: [], globals: [] } } as never)
    expect(appOnInit).toHaveBeenCalledOnce()
  })

  it('warns at boot for collections/globals registered AFTER the plugin (unhooked = tagged reads never bust)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const config = apply({ collections: [posts, { slug: 'optedOut', fields: [], custom: { revalidate: false } }] })
      // The booted config carries collections a LATER plugin contributed (icon) plus
      // Payload internals (payload-*) — only the former is a wiring mistake worth a warning.
      await config.onInit?.({
        config: {
          collections: [{ slug: 'posts' }, { slug: 'optedOut' }, { slug: 'icon' }, { slug: 'payload-preferences' }],
          globals: [{ slug: 'lateGlobal' }],
        },
      } as never)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('icon'))
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('global:lateGlobal'))
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('optedOut'))
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('payload-preferences'))

      warn.mockClear()
      const clean = apply({ collections: [posts] })
      await clean.onInit?.({ config: { collections: [{ slug: 'posts' }], globals: [] } } as never)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('stashes the tag prefix + declared scopes and exposes the inspection getter with graph + settings', () => {
    // Clear any booted-config stash a previous test left, so the graph builds from the raw config.
    ;(globalThis as Record<symbol, unknown>)[Symbol.for('pro-laico.payload-config')] = undefined
    apply(
      // `media` is registered too: edges into UNREGISTERED nodes are dropped (they'd
      // dangle in the dev-tools graph — see the payload-folders test below).
      { collections: [posts, { slug: 'media', fields: [] }], globals: [] },
      { prefix: 'shop', rules: [{ on: 'posts', bust: ['x'] }], collections: { posts: { lists: { recent: { fields: ['title'] } } } } },
    )
    expect(getState().prefix).toBe('shop')
    expect(getState().lists).toEqual({ posts: ['recent'], media: [] })
    const inspection = getInspection()
    expect(inspection?.prefix).toBe('shop')
    expect(inspection?.rules).toHaveLength(1)
    expect(inspection?.graph.edges).toContainEqual({ from: 'posts', to: 'media', via: 'hero', kind: 'upload' })
    expect(inspection?.settings.posts).toEqual({ idField: 'slug', lists: { recent: ['title'] }, extraTags: [], fields: ['slug', 'hero'] })
  })

  it('drops graph edges into filtered-out nodes (the injected payload-folders relationship)', () => {
    ;(globalThis as Record<symbol, unknown>)[Symbol.for('pro-laico.payload-config')] = undefined
    apply({
      collections: [
        { slug: 'images', fields: [{ name: 'folder', type: 'relationship', relationTo: 'payload-folders' }] },
        { slug: 'payload-folders', fields: [] },
      ],
      globals: [],
    })
    const graph = getInspection()?.graph
    expect(graph?.collections).not.toContain('payload-folders')
    expect(graph?.edges.some((e) => e.to === 'payload-folders')).toBe(false)
  })
})
