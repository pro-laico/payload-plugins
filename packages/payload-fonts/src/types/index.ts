// Root barrel for all package types. Code OUTSIDE `types/` imports from here; type files INSIDE
// `types/` must import their siblings directly (never through this barrel) to stay acyclic.
export type * from './active'
export type * from './collections'
export type * from './families'
export type * from './frontend'
export type * from './plugin'
export type * from './subset'

// `Family` is declared in BOTH ./export and ./download (intentional local aliases, both `string`).
// Re-export it from ./export only; take ./download's remaining types by name to avoid the collision.
export type * from './export'
export type { RunDownloadFontsOptions, WeightFile } from './download'
