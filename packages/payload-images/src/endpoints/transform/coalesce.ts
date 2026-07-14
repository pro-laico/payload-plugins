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
