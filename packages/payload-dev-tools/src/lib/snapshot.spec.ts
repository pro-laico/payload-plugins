import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDevSnapshot } from './snapshot'

/** A minimal fake Payload: counts come from `docs`, finds/findGlobal from the provided maps. */
const fakePayload = ({
  custom = {},
  collections = [] as { slug: string; custom?: Record<string, unknown> }[],
  globals = [] as { slug: string }[],
  docs = {} as Record<string, number>,
  findDocs = {} as Record<string, unknown[]>,
  globalDocs = {} as Record<string, Record<string, unknown>>,
} = {}): Payload =>
  ({
    config: { custom, collections, globals, routes: { admin: '/admin' } },
    count: async ({ collection, where }: { collection: string; where?: Record<string, { equals?: unknown }> }) => {
      const total = docs[collection]
      if (total === undefined) throw new Error(`unknown collection ${collection}`)
      // A `where` filter halves the count — enough to tell filtered from unfiltered calls apart.
      return { totalDocs: where ? Math.floor(total / 2) : total }
    },
    find: async ({ collection }: { collection: string }) => ({ docs: findDocs[collection] ?? [] }),
    findGlobal: async ({ slug }: { slug: string }) => {
      if (!(slug in globalDocs)) throw new Error(`unknown global ${slug}`)
      return globalDocs[slug]
    },
  }) as unknown as Payload

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildDevSnapshot', () => {
  it('reports a bare config: no plugins, counted collections, null counts for uncountable slugs', async () => {
    const snapshot = await buildDevSnapshot(
      fakePayload({ collections: [{ slug: 'users' }, { slug: 'broken' }], globals: [{ slug: 'settings' }], docs: { users: 3 } }),
    )
    expect(snapshot.plugins).toEqual({ seed: false, images: false, icons: false, fonts: false, mux: false })
    expect(snapshot.seed).toBeNull()
    expect(snapshot.collections).toEqual([
      { slug: 'users', count: 3 },
      { slug: 'broken', count: null },
    ])
    expect(snapshot.globals).toEqual(['settings'])
    expect(snapshot.adminRoute).toBe('/admin')
    expect(snapshot.devRoute).toBe('/dev')
  })

  it('builds the seed panel from the payloadSeed marker (counts, totals, ENABLE_SEED)', async () => {
    vi.stubEnv('ENABLE_SEED', 'true')
    const payload = fakePayload({
      custom: {
        payloadSeed: {
          options: {
            definitions: [
              { slug: 'services', kind: 'collection' },
              { slug: 'posts', kind: 'collection', disabled: 'missing creds' },
              { slug: 'site-settings', kind: 'global' },
            ],
          },
        },
      },
      collections: [{ slug: 'services' }, { slug: 'posts' }],
      docs: { services: 4, posts: 2 },
    })
    const { seed } = await buildDevSnapshot(payload)
    expect(seed).toMatchObject({ enabled: true, seeded: true, totalDocs: 6, counts: { services: 4, posts: 2 } })
    expect(seed?.definitions).toEqual([
      { slug: 'services', kind: 'collection' },
      { slug: 'posts', kind: 'collection', disabled: 'missing creds' },
      { slug: 'site-settings', kind: 'global' },
    ])
  })

  it('reports seed as locked + unseeded when ENABLE_SEED is unset and collections are empty', async () => {
    const payload = fakePayload({
      custom: { payloadSeed: { options: { definitions: [{ slug: 'services', kind: 'collection' }] } } },
      collections: [{ slug: 'services' }],
      docs: { services: 0 },
    })
    const { seed } = await buildDevSnapshot(payload)
    expect(seed).toMatchObject({ enabled: false, seeded: false, totalDocs: 0 })
  })

  it('builds the icons panel: count, active set title, runtime misses', async () => {
    const payload = fakePayload({
      custom: { payloadIcons: { iconSlug: 'icon', iconSetSlug: 'iconSet', iconRequestSlug: 'iconRequest' } },
      collections: [{ slug: 'icon' }, { slug: 'iconSet' }, { slug: 'iconRequest' }],
      docs: { icon: 12, iconSet: 1, iconRequest: 1 },
      findDocs: {
        iconSet: [{ title: 'Lucide-ish' }],
        iconRequest: [{ name: 'sparkles', count: 7, lastRequestedAt: '2026-07-01T00:00:00.000Z' }],
      },
    })
    const { icons } = await buildDevSnapshot(payload)
    expect(icons).toEqual({
      iconSlug: 'icon',
      iconSetSlug: 'iconSet',
      iconCount: 12,
      activeSet: 'Lucide-ish',
      misses: [{ name: 'sparkles', count: 7, lastRequestedAt: '2026-07-01T00:00:00.000Z' }],
    })
  })

  it('builds the fonts panel: family slots resolved to typeface titles via the fontSet global', async () => {
    const payload = fakePayload({
      custom: {
        payloadFonts: {
          fontSlug: 'font',
          fontSetSlug: 'fontSet',
          fontOptimizedSlug: 'fontOptimized',
          familyKeys: ['sans', 'mono'],
          exportPath: '/fonts/export',
        },
      },
      collections: [{ slug: 'font' }],
      docs: { font: 2 },
      globalDocs: { fontSet: { sans: { title: 'Inter' }, mono: null } },
    })
    const { fonts } = await buildDevSnapshot(payload)
    expect(fonts).toEqual({
      fontSlug: 'font',
      fontSetSlug: 'fontSet',
      fontOptimizedSlug: 'fontOptimized',
      familyKeys: ['sans', 'mono'],
      slots: { sans: 'Inter', mono: null },
      fontCount: 2,
      exportPath: '/api/fonts/export',
    })
  })

  it('builds the mux panel: slug from options, credentials from the seedDisabled marker, ready via where', async () => {
    const payload = fakePayload({
      custom: { payloadMux: { options: {} } },
      collections: [{ slug: 'mux-video', custom: { seedDisabled: 'Mux credentials not set' } }],
      docs: { 'mux-video': 8 },
    })
    const { mux } = await buildDevSnapshot(payload)
    expect(mux).toEqual({ slug: 'mux-video', credentialed: false, total: 8, ready: 4 })
  })

  it('builds the images panel from the payloadImages marker', async () => {
    const payload = fakePayload({
      custom: { payloadImages: { sourceSlug: 'images', variantSlug: 'generated-images', basePath: '/img' } },
      collections: [{ slug: 'images' }, { slug: 'generated-images' }],
      docs: { images: 5, 'generated-images': 40 },
    })
    const { images } = await buildDevSnapshot(payload)
    expect(images).toEqual({ sourceSlug: 'images', variantSlug: 'generated-images', basePath: '/api/img', sourceCount: 5, variantCount: 40 })
  })
})
