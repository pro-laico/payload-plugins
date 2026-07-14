import type { CollectionSlug, GlobalSlug, Payload, Where } from 'payload'

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
  RevalidateInspection,
  RevalidateMarker,
  RevalidateSnapshot,
  SeedMarker,
  SeedSnapshot,
} from '../types'

const countDocs = async (payload: Payload, slug: string, where?: Where): Promise<number | null> => {
  try {
    //TODO: replace `as` cast with proper typing
    return (await payload.count({ collection: slug as CollectionSlug, ...(where ? { where } : {}) })).totalDocs
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
        collection: iconSetSlug as CollectionSlug, //TODO: replace `as` cast with proper typing
        where: { active: { equals: true } },
        limit: 1,
        depth: 0,
        pagination: false,
      })
      const doc = res.docs[0] as { title?: string } | undefined //TODO: replace `as` cast with proper typing
      activeSet = doc?.title ?? null
    } catch {}
  }

  let misses: IconsSnapshot['misses'] = []
  if (marker.iconRequestSlug) {
    try {
      const res = await payload.find({
        collection: marker.iconRequestSlug as CollectionSlug, //TODO: replace `as` cast with proper typing
        sort: '-count',
        limit: 20,
        depth: 0,
        pagination: false,
      })
      //TODO: replace `as` cast with proper typing
      misses = (res.docs as { name?: string; count?: number; lastRequestedAt?: string }[]).flatMap((d) =>
        d.name ? [{ name: d.name, count: d.count ?? 1, lastRequestedAt: d.lastRequestedAt ?? null }] : [],
      )
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
      // Through `unknown`: in an app context `findGlobal` returns the app's generated global type.
      //TODO: replace `as` cast with proper typing
      const set = (await payload.findGlobal({ slug: fontSetSlug as GlobalSlug, depth: 1 })) as unknown as Record<string, unknown>
      for (const key of familyKeys) {
        const value = set[key]
        //TODO: replace `as` cast with proper typing
        slots[key] = value && typeof value === 'object' && 'title' in value ? ((value as { title?: string }).title ?? null) : null
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
  //TODO: replace `as` cast with proper typing
  const inspect = (globalThis as Record<symbol, unknown>)[Symbol.for('pro-laico.payload-revalidate.inspect')] as
    | (() => RevalidateInspection)
    | undefined
  const data = inspect?.()
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
  //TODO: replace `as` cast with proper typing
  const custom = (payload.config.custom ?? {}) as Record<string, Record<string, unknown> | undefined>
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
    devRoute: (custom.payloadDevTools?.devRoute as string | undefined) ?? '/dev', //TODO: replace `as` cast with proper typing
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
