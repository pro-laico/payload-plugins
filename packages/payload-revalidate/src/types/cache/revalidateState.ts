export interface RevalidateState {
  prefix: string
  /** Whether the dev observer records reads/events — the resolved `observe` option. */
  observe: boolean
  /** Per-collection declared list scopes (from `options.collections[slug].lists`) — read by
   *  `cacheIds` (undeclared-scope dev warning) and the after-seed flush (bust every scope). */
  lists?: Record<string, string[]>
  /** Per-collection static extra tags (markers + options merged) — the after-seed flush busts
   *  them for touched slugs, since entries carrying ONLY an extra tag (e.g. a scope inlining
   *  icons tagged `payload-icons`) don't carry `all` and would otherwise survive a reseed. */
  extraTags?: Record<string, string[]>
  /** The resolved dependency rules — the after-seed flush busts their targets for touched
   *  slugs (same rationale as `extraTags`: rule targets live outside `./cache`, carry no
   *  `all`, and would otherwise survive a reseed). Structural to avoid an import cycle. */
  rules?: { on: string; bust: string[]; whenFields?: string[] }[]
}
