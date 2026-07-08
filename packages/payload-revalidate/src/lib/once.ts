/**
 * A "do this at most once per key" guard. The plugin logs advisories (bake-in warnings,
 * malformed-config notices, no-request-scope alerts) that must fire once per process, not
 * once per request/save — several modules had each grown their own `Set` + has/add dance.
 * `createOnce` is that dedupe, isolated per call site so unrelated warnings can't collide.
 *
 * @example
 * ```ts
 * const seen = createOnce()
 * const warn = (key: string, msg: string) => { if (seen(key)) console.warn(msg) }
 * ```
 */
export const createOnce = (): ((key: string) => boolean) => {
  const seen = new Set<string>()
  return (key: string): boolean => {
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
}
