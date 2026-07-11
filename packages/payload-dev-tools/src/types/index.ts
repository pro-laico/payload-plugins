// Root type barrel — every public + internal type, grouped by domain subfolder. Only code
// OUTSIDE `types/` imports this; type files inside `types/` import siblings directly (acyclic).
//
// Collision note: `RevalidateInspection` is declared in two files — the rich live-inspection
// shape in `revalidate/revalidate-inspection.ts` and a structural stub in
// `snapshot/snapshot-markers.ts`. The `snapshot` subfolder barrel deliberately omits its stub,
// so the name resolves here to the rich `revalidate` version only.
export type * from './dev-page'
export type * from './harness'
export type * from './plugin'
export type * from './revalidate'
export type * from './shared'
export type * from './snapshot'
export type * from './specimen'
export type * from './toolbar'
