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

export type RevalidateSnapshot = {
  /** Where the map endpoint lives (`/api/revalidate-map`), or null when disabled. */
  endpointPath: string | null
  /** Tag namespace prefix ('' when unset). */
  prefix: string
  /** Whether the plugin is recording reads/events in this process. */
  observing: boolean
  /** Static reference-graph edge count ("can embed" relationships). */
  edges: number
  /** Materialized cached reads / bust events observed so far. */
  reads: number
  events: number
}

/** Everything `GET /api/dev` reports: environment, per-plugin panels (null = plugin not
 *  installed), and doc counts for every collection. Built fresh on each request — dev only. */
export type DevSnapshot = {
  generatedAt: string
  env: { nodeEnv: string; nodeVersion: string }
  adminRoute: string
  /** Where the host mounts the `createDevPage` catch-all (the plugin's `devRoute` option). */
  devRoute: string
  plugins: { seed: boolean; images: boolean; icons: boolean; fonts: boolean; mux: boolean; revalidate: boolean }
  seed: SeedSnapshot | null
  images: ImagesSnapshot | null
  icons: IconsSnapshot | null
  fonts: FontsSnapshot | null
  mux: MuxSnapshot | null
  revalidate: RevalidateSnapshot | null
  collections: CollectionCount[]
  globals: string[]
}
