/**
 * Per-key request coalescing. By default the entry is cleared as the value resolves (zero
 * staleness — a later call re-runs). When the optional `settle` hook returns a promise, the entry
 * instead stays resident until that promise settles, so work completing asynchronously AFTER the
 * value is produced (a deferred variant persist) keeps coalescing same-key callers onto the
 * resident result instead of re-running the fn.
 */
export const createSingleFlight = <K, V>(
  settle?: (value: V) => Promise<unknown> | undefined,
): ((key: K, fn: () => Promise<V>) => Promise<V>) => {
  const inflight = new Map<K, Promise<V>>()
  return (key, fn) => {
    const existing = inflight.get(key)
    if (existing) return existing
    const p = Promise.resolve()
      .then(fn)
      .then(
        (value) => {
          const wait = settle?.(value)
          if (wait) {
            void Promise.resolve(wait)
              .catch(() => undefined)
              .then(() => inflight.delete(key))
          } else {
            inflight.delete(key)
          }
          return value
        },
        (err: unknown) => {
          inflight.delete(key)
          throw err
        },
      )
    inflight.set(key, p)
    return p
  }
}
