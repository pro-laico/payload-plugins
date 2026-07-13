/** Append each per-phase hook array in `extra` after the corresponding `base` array. */
export const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b = base as unknown as Record<string, unknown[] | undefined> //EXCUSE: Payload's hooks object is iterated generically; arrays are recombined per key
  const e = extra as unknown as Record<string, unknown[] | undefined> //EXCUSE: same as above
  const out: Record<string, unknown[] | undefined> = { ...b }
  for (const key of Object.keys(e)) out[key] = [...(b[key] ?? []), ...(e[key] ?? [])]
  return out as unknown as T //EXCUSE: reverse of the generic widening above
}
