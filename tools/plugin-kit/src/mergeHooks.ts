// Merges hook objects: concatenates the array-valued phases of `extra` onto a copy of `base`.
// Spreading the generic T keeps the return type; Reflect handles the dynamic keys without a cast.
export const mergeHooks = <T extends object>(base: T, extra?: T): T => {
  if (!extra) return base
  const out = { ...base }
  for (const [key, extraValue] of Object.entries(extra)) {
    if (!Array.isArray(extraValue)) continue
    const baseValue = Reflect.get(base, key)
    Reflect.set(out, key, [...(Array.isArray(baseValue) ? baseValue : []), ...extraValue])
  }
  return out
}
