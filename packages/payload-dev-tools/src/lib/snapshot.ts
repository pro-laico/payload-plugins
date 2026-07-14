import type { Payload, Where } from 'payload'

import { isRecord } from './isRecord'
import type {
  CollectionCount,
  DevSnapshot,
  FontsMarker,
  FontsSnapshot,
  IconsMarker,
  IconsSnapshot,
  ImagesMarker,
  ImagesSnapshot,
  MuxMarker,
  MuxSnapshot,
  RevalidateMarker,
  RevalidateSnapshot,
  SeedMarker,
  SeedSnapshot,
} from '../types'

const countDocs = async (payload: Payload, slug: string, where?: Where): Promise<number | null> => {
  try {
    return (await payload.count({ collection: slug, ...(where ? { where } : {}) })).totalDocs
  } catch {
    return null
  }
}

const seedSnapshot = async (payload: Payload, marker: SeedMarker): Promise<SeedSnapshot> => {
  const definitions = (marker.options?.definitions ?? []).map((d) => ({
    slug: d.slug,
    kind: d.kind,
    ...(d.disabled ? { disabled: typeof d.disabled === 'string' ? d.disabled : 'disabled' } : {}),
  }))
  const counts: Record<string, number> = {}
  for (const d of definitions) {
    if (d.kind !== 'collection') continue
    const n = await countDocs(payload, d.slug)
    if (n !== null) counts[d.slug] = n
  }
  const totalDocs = Object.values(counts).reduce((sum, n) => sum + n, 0)
  return { enabled: process.env.ENABLE_SEED === 'true', endpoint: '/api/seed', definitions, counts, totalDocs, seeded: totalDocs > 0 }
}

const imagesSnapshot = async (payload: Payload, marker: ImagesMarker): Promise<ImagesSnapshot> => {
  const sourceSlug = marker.sourceSlug ?? 'images'
  const variantSlug = marker.variantSlug ?? null
  return {
    sourceSlug,
    variantSlug,
    basePath: `/api${marker.basePath ?? '/img'}`,
    sourceCount: await countDocs(payload, sourceSlug),
    variantCount: variantSlug ? await countDocs(payload, variantSlug) : null,
  }
}

const iconsSnapshot = async (payload: Payload, marker: IconsMarker): Promise<IconsSnapshot> => {
  const iconSlug = marker.iconSlug ?? 'icon'
  const iconSetSlug = marker.iconSetSlug ?? null

  let activeSet: string | null = null
  if (iconSetSlug) {
    try {
      const res = await payload.find({
        collection: iconSetSlug,
        where: { active: { equals: true } },
        limit: 1,
        depth: 0,
        pagination: false,
      })
      const title = res.docs[0]?.title
      activeSet = typeof title === 'string' ? title : null
    } catch {}
  }

  let misses: IconsSnapshot['misses'] = []
  if (marker.iconRequestSlug) {
    try {
      const res = await payload.find({
        collection: marker.iconRequestSlug,
        sort: '-count',
        limit: 20,
        depth: 0,
        pagination: false,
      })
      misses = res.docs.flatMap((d) => {
        const name = typeof d.name === 'string' ? d.name : undefined
        if (!name) return []
        return [
          {
            name,
            count: typeof d.count === 'number' ? d.count : 1,
            lastRequestedAt: typeof d.lastRequestedAt === 'string' ? d.lastRequestedAt : null,
          },
        ]
      })
    } catch {}
  }

  return { iconSlug, iconSetSlug, iconCount: await countDocs(payload, iconSlug), activeSet, misses }
}

const fontsSnapshot = async (payload: Payload, marker: FontsMarker): Promise<FontsSnapshot> => {
  const fontSlug = marker.fontSlug ?? 'font'
  const fontSetSlug = marker.fontSetSlug ?? null
  const familyKeys = marker.familyKeys ?? []

  const slots: Record<string, string | null> = {}
  for (const key of familyKeys) slots[key] = null
  if (fontSetSlug && familyKeys.length) {
    try {
      const set = await payload.findGlobal({ slug: fontSetSlug, depth: 1 })
      for (const key of familyKeys) {
        const value = set[key]
        slots[key] = isRecord(value) && typeof value.title === 'string' ? value.title : null
      }
    } catch {}
  }

  return {
    fontSlug,
    fontSetSlug,
    fontOptimizedSlug: marker.fontOptimizedSlug ?? null,
    familyKeys,
    slots,
    fontCount: await countDocs(payload, fontSlug),
    exportPath: `/api${marker.exportPath ?? '/fonts/export'}`,
  }
}

const muxSnapshot = async (payload: Payload, marker: MuxMarker): Promise<MuxSnapshot> => {
  const slug = marker.options?.extendCollection ?? 'mux-video'
  const collection = payload.config.collections.find((c) => c.slug === slug)
  return {
    slug,
    credentialed: !collection?.custom?.seedDisabled,
    total: await countDocs(payload, slug),
    ready: await countDocs(payload, slug, { status: { equals: 'ready' } }),
  }
}

const revalidateSnapshot = (marker: RevalidateMarker): RevalidateSnapshot => {
  // Reads payload-revalidate's Symbol.for inspect slot cross-package without importing it.
  const inspect = Reflect.get(globalThis, Symbol.for('pro-laico.payload-revalidate.inspect'))
  const data = typeof inspect === 'function' ? inspect() : undefined
  return {
    endpointPath: marker.endpointPath ?? null,
    prefix: data?.prefix ?? '',
    observing: data?.observing ?? false,
    edges: data?.graph.edges.length ?? 0,
    reads: data?.reads.length ?? 0,
    events: data?.events.length ?? 0,
  }
}

export async function buildDevSnapshot(payload: Payload): Promise<DevSnapshot> {
  const custom = payload.config.custom ?? {}
  const muxMarker = custom.payloadMux
  const seedMarker = custom.payloadSeed
  const iconsMarker = custom.payloadIcons
  const fontsMarker = custom.payloadFonts
  const imagesMarker = custom.payloadImages
  const revalidateMarker = custom.payloadRevalidate

  const collections: CollectionCount[] = []
  for (const c of payload.config.collections) collections.push({ slug: c.slug, count: await countDocs(payload, c.slug) })

  return {
    generatedAt: new Date().toISOString(),
    env: { nodeEnv: process.env.NODE_ENV ?? 'development', nodeVersion: process.version },
    adminRoute: payload.config.routes?.admin ?? '/admin',
    devRoute: typeof custom.payloadDevTools?.devRoute === 'string' ? custom.payloadDevTools.devRoute : '/dev',
    plugins: {
      seed: !!seedMarker,
      images: !!imagesMarker,
      icons: !!iconsMarker,
      fonts: !!fontsMarker,
      mux: !!muxMarker,
      revalidate: !!revalidateMarker,
    },
    seed: seedMarker ? await seedSnapshot(payload, seedMarker) : null,
    images: imagesMarker ? await imagesSnapshot(payload, imagesMarker) : null,
    icons: iconsMarker ? await iconsSnapshot(payload, iconsMarker) : null,
    fonts: fontsMarker ? await fontsSnapshot(payload, fontsMarker) : null,
    mux: muxMarker ? await muxSnapshot(payload, muxMarker) : null,
    revalidate: revalidateMarker ? revalidateSnapshot(revalidateMarker) : null,
    collections,
    globals: (payload.config.globals ?? []).map((g) => g.slug),
  }
}
