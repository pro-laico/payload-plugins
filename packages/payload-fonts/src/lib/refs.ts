/**
 * Resolve a Payload relationship/upload value to its id, whether it's populated (a doc with
 * `id`) or just the raw id (string/number). Returns `undefined` for null/empty. Shared by every
 * place that reads a slot value at `depth: 0` (the export endpoint, the optimize reconcile hook,
 * the active-fonts resolver), so the unwrapping rule lives in exactly one spot.
 */
export const refId = (ref: unknown): string | number | undefined => {
  if (ref && typeof ref === 'object') return (ref as { id?: string | number }).id
  return (ref as string | number | null | undefined) ?? undefined
}
