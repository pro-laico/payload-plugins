/**
 * Per-field change detection between a write's `doc` and `previousDoc` — enough to gate
 * list-tag busts (`listFields`) and dependency rules (`whenFields`) without deep-diff
 * cost. Returns `null` when there's nothing to compare against (create, or hooks that
 * don't get a previous doc): callers treat `null` as "assume changed".
 *
 * Two Payload realities the comparison has to absorb:
 *
 * - **Depth asymmetry.** `previousDoc` is always read at depth 0, but `doc` comes back at
 *   the REQUEST's depth (local API default: 2) — so a populated relationship (`{ id, … }`)
 *   would diff as changed against its previous raw id on every write. The caller passes
 *   the collection's top-level relationship/upload field names and their values are
 *   normalized to ids before comparing.
 * - **Derived fields.** Joins are query results, not stored values — they're excluded
 *   from the diff entirely (`ignoreFields`).
 */
export interface ChangeDetectionSchema {
  /** Top-level relationship/upload field names — normalized to ids before comparison. */
  relationFields?: string[]
  /** Top-level derived fields (joins) — excluded from the diff. */
  ignoreFields?: string[]
}
