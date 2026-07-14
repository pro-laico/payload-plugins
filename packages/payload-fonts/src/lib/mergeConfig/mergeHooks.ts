export const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b = base as unknown as Record<string, unknown[] | undefined> //TODO: replace `as` cast with proper typing
  const e = extra as unknown as Record<string, unknown[] | undefined> //TODO: replace `as` cast with proper typing
  const out: Record<string, unknown[]> = { ...b } as Record<string, unknown[]> //TODO: replace `as` cast with proper typing
  for (const key of Object.keys(e)) out[key] = [...(b[key] ?? []), ...(e[key] ?? [])]
  return out as unknown as T //TODO: replace `as` cast with proper typing
}
