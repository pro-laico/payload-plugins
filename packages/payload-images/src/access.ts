import type { Access, Where } from 'payload'

// The shared primitives, re-exported so this stays the one access import for the package.
export { anyone, authd } from './_kit'

// Re-roots a source-collection where-constraint through the variant's `source` relationship.
const prefixWhere = (where: Where, prefix: string): Where =>
  Object.fromEntries(
    Object.entries(where).map(([key, value]) =>
      (key === 'and' || key === 'or') && Array.isArray(value)
        ? [key, value.map((w) => prefixWhere(w as Where, prefix))]
        : [`${prefix}.${key}`, value],
    ),
  )

/**
 * Variant rows are readable only when their SOURCE doc is: the source collection's read access runs
 * for the caller and is applied through the `source` relationship, so a tenant-scoped or owner-only
 * source policy scopes the cached pixels too. Auth is still required first (the pre-existing
 * baseline — anonymous traffic gets bytes from the transform endpoint, never from this collection).
 */
export const readScopedToSource =
  (sourceSlug: string): Access =>
  async ({ req }) => {
    if (!req.user) return false
    const sourceRead = req.payload.collections[sourceSlug]?.config?.access?.read
    if (!sourceRead) return true
    const result = await sourceRead({ req })
    return typeof result === 'boolean' ? result : prefixWhere(result, 'source')
  }
