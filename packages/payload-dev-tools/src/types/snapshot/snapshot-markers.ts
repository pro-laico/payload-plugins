export type SeedMarker = { options?: { definitions?: { slug: string; kind: 'collection' | 'global'; disabled?: string | boolean }[] } }

export type ImagesMarker = { sourceSlug?: string; variantSlug?: string | null; basePath?: string }

export type IconsMarker = { iconSlug?: string; iconSetSlug?: string | null; iconRequestSlug?: string | null }

export type FontsMarker = {
  fontSlug?: string
  fontSetSlug?: string | null
  fontOptimizedSlug?: string | null
  familyKeys?: string[]
  exportPath?: string
}

export type MuxMarker = { options?: { extendCollection?: string } }

export type RevalidateMarker = { endpointPath?: string | null }

/** The live-inspection shape payload-revalidate stashes on its shared symbol slot (functions
 *  can't ride `config.custom` — it feeds the serialized client config). Structural — no import. */
export type RevalidateInspection = { graph: { edges: unknown[] }; prefix: string; observing: boolean; reads: unknown[]; events: unknown[] }
