// Root barrel for the app's hand-written types. Two thematic groups:
//   ./data  — frontend `depth: 0` view models the site renders (see ./data/primitives)
//   ./props — component-local prop types
// Files inside types/ import their siblings DIRECTLY (never through this barrel) to stay acyclic;
// only code OUTSIDE types/ imports from here.
//
// Note: `Props` (from ./props/section-heading) is a deliberately generic name. It is re-exported
// here for completeness, but its consumer imports it from '@/types/props/section-heading' directly
// to avoid leaking a generic `Props` into the `@/types` namespace.

export type * from './data'
export type * from './props'
