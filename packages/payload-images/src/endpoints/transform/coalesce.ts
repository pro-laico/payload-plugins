/**
 * In-memory single-flight: collapse concurrent calls for the same key onto one shared promise,
 * clearing the entry the moment it settles (zero staleness window). Per-process best-effort —
 * dedupes the source read across a `<img>`'s srcset widths and coalesces variant generation
 * under a thundering herd.
 */
export const createSingleFlight = <K, V>(): ((key: K, fn: () => Promise<V>) => Promise<V>) => {
  const inflight = new Map<K, Promise<V>>()
  return (key, fn) => {
    const existing = inflight.get(key)
    if (existing) return existing
    const p = Promise.resolve()
      .then(fn)
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }
}
