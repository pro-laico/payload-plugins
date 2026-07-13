/**
 * Additively merge two Payload hooks objects: each per-phase array in `extra` is
 * appended to the corresponding array in `base`. Phases present in only one of the
 * two are preserved as-is. User hooks always run AFTER base hooks within a phase.
 *
 * Vendored (with `mergeCollection` / `mergeGlobal`) so this package carries no
 * dependency on a shared `core` utility package — it's ~40 lines and stable.
 */
export const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b = base as unknown as Record<string, unknown[] | undefined>
  const e = extra as unknown as Record<string, unknown[] | undefined>
  const out: Record<string, unknown[]> = { ...b } as Record<string, unknown[]>
  for (const key of Object.keys(e)) out[key] = [...(b[key] ?? []), ...(e[key] ?? [])]
  return out as unknown as T
}
