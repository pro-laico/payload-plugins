/**
 * Root barrel for every public type in the package, composed from the per-domain subfolder
 * barrels. Code OUTSIDE `types/` imports from here; type files INSIDE `types/` must import their
 * siblings directly (relative path), never through this barrel, to stay acyclic.
 *
 * COLLISION: two distinct `ImageDocLike` types exist — `urls/virtualUrlDoc` (exposed here) and
 * `placeholders/blurhashDoc` (the placeholder-reader duck-type, omitted from the `placeholders`
 * barrel). Consumers of the latter import it directly from `types/placeholders/blurhashDoc`.
 */
export type * from './collections'
export type * from './metadata'
export type * from './placeholders'
export type * from './plugin'
export type * from './props'
export type * from './transform'
export type * from './urls'
