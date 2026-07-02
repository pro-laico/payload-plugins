import type { CollectionSlug, GlobalSlug, Payload, Where } from 'payload'

/** One collection's row in the snapshot. `count` is null when counting failed (e.g. a slug the
 *  adapter can't count) — distinct from an honest 0. */
export type CollectionCount = { slug: string; count: number | null }

export type SeedSnapshot = {
  /** Whether `ENABLE_SEED=true` is set — the kill switch every seed path checks. */
  enabled: boolean
  endpoint: string
  definitions: { slug: string; kind: 'collection' | 'global'; disabled?: string }[]
  /** Doc counts per collection-kind definition slug (globals always exist, so they're skipped). */
  counts: Record<string, number>
  totalDocs: number
  /** True once any seeded collection has documents. */
  seeded: boolean
}

export type ImagesSnapshot = {
  sourceSlug: string
  variantSlug: string | null
  basePath: string
  sourceCount: number | null
  variantCount: number | null
}

export type IconsSnapshot = {
  iconSlug: string
  iconSetSlug: string | null
  iconCount: number | null
  /** Title of the active (published) icon set, or null when none is active. */
  activeSet: string | null
  /** Runtime misses from the `iconRequest` diagnostic collection — names requested in code that
   *  did not resolve through the active set. Empty when request tracking is off. */
  misses: { name: string; count: number; lastRequestedAt: string | null }[]
}

export type FontsSnapshot = {
  fontSlug: string
  fontSetSlug: string | null
  fontOptimizedSlug: string | null
  familyKeys: string[]
  /** Active typeface title per family slot (from the `fontSet` global), or null when unset. */
  slots: Record<string, string | null>
  fontCount: number | null
  exportPath: string
}

export type MuxSnapshot = { slug: string; credentialed: boolean; total: number | null; ready: number | null }

/** Everything `GET /api/dev` reports: environment, per-plugin panels (null = plugin not
 *  installed), and doc counts for every collection. Built fresh on each request — dev only. */
export type DevSnapshot = {
  generatedAt: string
  env: { nodeEnv: string; nodeVersion: string }
  adminRoute: string
  /** Where the host mounts the `createDevPage` catch-all (the plugin's `devRoute` option). */
  devRoute: string
  plugins: { seed: boolean; images: boolean; icons: boolean; fonts: boolean; mux: boolean }
  seed: SeedSnapshot | null
  images: ImagesSnapshot | null
  icons: IconsSnapshot | null
  fonts: FontsSnapshot | null
  mux: MuxSnapshot | null
  collections: CollectionCount[]
  globals: string[]
}

const countDocs = async (payload: Payload, slug: string, where?: Where): Promise<number | null> => {
  try {
    return (await payload.count({ collection: slug as CollectionSlug, overrideAccess: true, ...(where ? { where } : {}) })).totalDocs
  } catch {
    return null
  }
}

type SeedMarker = { options?: { definitions?: { slug: string; kind: 'collection' | 'global'; disabled?: string | boolean }[] } }

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

type ImagesMarker = { sourceSlug?: string; variantSlug?: string | null; basePath?: string }

const imagesSnapshot = async (payload: Payload, marker: ImagesMarker): Promise<ImagesSnapshot> => {
  const sourceSlug = marker.sourceSlug ?? 'images'
  const variantSlug = marker.variantSlug ?? null
  return {
    sourceSlug,
    variantSlug,
    // The marker stores the endpoint-relative path ('/img'); report it as requested (/api/img).
    basePath: `/api${marker.basePath ?? '/img'}`,
    sourceCount: await countDocs(payload, sourceSlug),
    variantCount: variantSlug ? await countDocs(payload, variantSlug) : null,
  }
}

type IconsMarker = { iconSlug?: string; iconSetSlug?: string | null; iconRequestSlug?: string | null }

const iconsSnapshot = async (payload: Payload, marker: IconsMarker): Promise<IconsSnapshot> => {
  const iconSlug = marker.iconSlug ?? 'icon'
  const iconSetSlug = marker.iconSetSlug ?? null

  let activeSet: string | null = null
  if (iconSetSlug) {
    try {
      const res = await payload.find({
        collection: iconSetSlug as CollectionSlug,
        where: { active: { equals: true } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      })
      const doc = res.docs[0] as { title?: string } | undefined
      activeSet = doc?.title ?? null
    } catch {}
  }

  let misses: IconsSnapshot['misses'] = []
  if (marker.iconRequestSlug) {
    try {
      const res = await payload.find({
        collection: marker.iconRequestSlug as CollectionSlug,
        sort: '-count',
        limit: 20,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      })
      misses = (res.docs as { name?: string; count?: number; lastRequestedAt?: string }[]).flatMap((d) =>
        d.name ? [{ name: d.name, count: d.count ?? 1, lastRequestedAt: d.lastRequestedAt ?? null }] : [],
      )
    } catch {}
  }

  return { iconSlug, iconSetSlug, iconCount: await countDocs(payload, iconSlug), activeSet, misses }
}

type FontsMarker = {
  fontSlug?: string
  fontSetSlug?: string | null
  fontOptimizedSlug?: string | null
  familyKeys?: string[]
  exportPath?: string
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
      const set = (await payload.findGlobal({ slug: fontSetSlug as GlobalSlug, depth: 1, overrideAccess: true })) as unknown as Record<
        string,
        unknown
      >
      for (const key of familyKeys) {
        const value = set[key]
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

type MuxMarker = { options?: { extendCollection?: string } }

const muxSnapshot = async (payload: Payload, marker: MuxMarker): Promise<MuxSnapshot> => {
  const slug = marker.options?.extendCollection ?? 'mux-video'
  const collection = payload.config.collections.find((c) => c.slug === slug)
  return {
    slug,
    // The mux plugin marks its collection `custom.seedDisabled` when MUX_TOKEN_ID/SECRET are absent.
    credentialed: !collection?.custom?.seedDisabled,
    total: await countDocs(payload, slug),
    ready: await countDocs(payload, slug, { status: { equals: 'ready' } }),
  }
}

/** Build the full dev snapshot from a booted Payload instance. Sibling @pro-laico plugins are
 *  discovered through their `config.custom` markers — no imports, so none of them are required. */
export async function buildDevSnapshot(payload: Payload): Promise<DevSnapshot> {
  const custom = (payload.config.custom ?? {}) as Record<string, Record<string, unknown> | undefined>
  const seedMarker = custom.payloadSeed
  const imagesMarker = custom.payloadImages
  const iconsMarker = custom.payloadIcons
  const fontsMarker = custom.payloadFonts
  const muxMarker = custom.payloadMux

  const collections: CollectionCount[] = []
  for (const c of payload.config.collections) collections.push({ slug: c.slug, count: await countDocs(payload, c.slug) })

  return {
    generatedAt: new Date().toISOString(),
    env: { nodeEnv: process.env.NODE_ENV ?? 'development', nodeVersion: process.version },
    adminRoute: payload.config.routes?.admin ?? '/admin',
    devRoute: (custom.payloadDevTools?.devRoute as string | undefined) ?? '/dev',
    plugins: { seed: !!seedMarker, images: !!imagesMarker, icons: !!iconsMarker, fonts: !!fontsMarker, mux: !!muxMarker },
    seed: seedMarker ? await seedSnapshot(payload, seedMarker) : null,
    images: imagesMarker ? await imagesSnapshot(payload, imagesMarker) : null,
    icons: iconsMarker ? await iconsSnapshot(payload, iconsMarker) : null,
    fonts: fontsMarker ? await fontsSnapshot(payload, fontsMarker) : null,
    mux: muxMarker ? await muxSnapshot(payload, muxMarker) : null,
    collections,
    globals: (payload.config.globals ?? []).map((g) => g.slug),
  }
}
