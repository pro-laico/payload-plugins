export type RevalidateMarker = { endpointPath?: string | null }

export type MuxMarker = { muxVideoSlug?: string }

export type ImagesMarker = { sourceSlug?: string; variantSlug?: string | null; basePath?: string }

export type IconsMarker = { iconSlug?: string; iconSetSlug?: string | null; iconRequestSlug?: string | null }

export type SeedMarker = { options?: { definitions?: { slug: string; kind: 'collection' | 'global'; disabled?: string | boolean }[] } }

export type RevalidateInspection = { graph: { edges: unknown[] }; prefix: string; observing: boolean; reads: unknown[]; events: unknown[] }

export type FontsMarker = {
  fontSlug?: string
  fontSetSlug?: string | null
  fontOptimizedSlug?: string | null
  familyKeys?: string[]
  exportPath?: string
}
