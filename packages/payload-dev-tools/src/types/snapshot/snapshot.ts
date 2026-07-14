export type CollectionCount = { slug: string; count: number | null }

export type MuxSnapshot = { slug: string; credentialed: boolean; total: number | null; ready: number | null }

export type SeedSnapshot = {
  enabled: boolean
  endpoint: string
  definitions: { slug: string; kind: 'collection' | 'global'; disabled?: string }[]
  counts: Record<string, number>
  totalDocs: number
  seeded: boolean
}

export type IconsSnapshot = {
  iconSlug: string
  iconSetSlug: string | null
  iconCount: number | null
  activeSet: string | null
  misses: { name: string; count: number; lastRequestedAt: string | null }[]
}

export type FontsSnapshot = {
  fontSlug: string
  fontSetSlug: string | null
  fontOptimizedSlug: string | null
  familyKeys: string[]
  slots: Record<string, string | null>
  fontCount: number | null
  exportPath: string
}

export type ImagesSnapshot = {
  sourceSlug: string
  variantSlug: string | null
  basePath: string
  sourceCount: number | null
  variantCount: number | null
}

export type RevalidateSnapshot = {
  endpointPath: string | null
  prefix: string
  observing: boolean
  edges: number
  reads: number
  events: number
}

export type DevSnapshot = {
  generatedAt: string
  env: { nodeEnv: string; nodeVersion: string }
  adminRoute: string
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
