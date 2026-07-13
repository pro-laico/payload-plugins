import { getState } from '../state'
import type { ObservedRead, Registry, RevalidateEvent } from '../../types'

/**
 * The dev-time observation registry behind the dependency map: every cached read the
 * `./cache` helpers materialize and every revalidation event the hooks fire, on a
 * `Symbol.for` globalThis slot so the endpoint and dev-tools read the same data with no
 * imports. Gated by the plugin's `observe` option (default: dev only) — production
 * traffic never pays for it. Reads dedupe by shape (a getter re-materializing after a
 * bust bumps `count`, it doesn't grow the map); events are a ring buffer.
 *
 * Note: a `'use cache'` helper only executes on cache MISS, so `reads` is the set of
 * entries that materialized — there is no hit counting (impossible from inside the
 * cached scope), and that's fine: the map answers "what exists and what busts it."
 */

const MAX_READS = 500
const MAX_EVENTS = 200

const REGISTRY_SLOT = Symbol.for('pro-laico.payload-revalidate.observer')

const registry = (): Registry => {
  const slot = globalThis as Record<symbol, unknown>
  if (!slot[REGISTRY_SLOT]) slot[REGISTRY_SLOT] = { reads: new Map(), events: [] } satisfies Registry
  return slot[REGISTRY_SLOT] as Registry
}

/** Whether observation is on (the resolved `observe` option, stashed by the plugin factory). */
export const observing = (): boolean => getState().observe

/** Record a materialized cached read (called by the `./cache` helpers). No-op unless {@link observing}. */
export const recordRead = (read: Omit<ObservedRead, 'firstAt' | 'lastAt' | 'count'>): void => {
  if (!observing()) return
  const { reads } = registry()
  const key = [
    read.kind,
    read.collection ?? read.global ?? '',
    String(read.as ?? ''),
    read.list ?? '',
    read.draft ? 'draft' : 'pub',
    read.label ?? '',
  ].join('|')
  const now = new Date().toISOString()
  const existing = reads.get(key)
  if (existing) {
    // delete-then-set refreshes Map insertion order — eviction below is LRU, so a hot
    // read that materializes often is never the one dropped at the cap.
    reads.delete(key)
    reads.set(key, { ...read, firstAt: existing.firstAt, lastAt: now, count: existing.count + 1 })
    return
  }
  if (reads.size >= MAX_READS) {
    const oldest = reads.keys().next().value
    if (oldest !== undefined) reads.delete(oldest)
  }
  reads.set(key, { ...read, firstAt: now, lastAt: now, count: 1 })
}

/** Record a revalidation event (called by `lib/bust.ts` BEFORE the tags are busted, so
 *  the map shows intent even in contexts where `revalidateTag` no-ops). */
export const recordEvent = (event: Omit<RevalidateEvent, 'at'>): void => {
  if (!observing()) return
  const { events } = registry()
  events.push({ ...event, at: new Date().toISOString() })
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

/** Snapshot for the map endpoint / dev-tools view: newest-first reads and events. */
export const getObservations = (): { reads: ObservedRead[]; events: RevalidateEvent[] } => {
  const { reads, events } = registry()
  return { reads: [...reads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)), events: [...events].reverse() }
}

/** Test/dev helper: drop everything recorded so far. */
export const resetObservations = (): void => {
  const { reads, events } = registry()
  reads.clear()
  events.length = 0
}
