/**
 * The value guards shared across the read side (`walk`, `cache`), the write side (`hooks`),
 * and the diff (`changedFields`, `joins`). Small predicates that had drifted into
 * byte-for-byte copies in several modules — one source now.
 */

/** A relationship/id primitive: a database id or an alias (`idField`) value. */
export const isId = (value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number'

/** A plain (non-array) object — the shape every populated doc and nested field-data value takes. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Narrow a hook's `doc`/`previousDoc` (typed `unknown`) to a record, or `{}` when it isn't one. */
export const docRecord = (doc: unknown): Record<string, unknown> => (isPlainObject(doc) ? doc : {})
