import type { ObservedRead, Registry, RevalidateEvent } from '../../types'

const MAX_READS = 500
const MAX_EVENTS = 200

// Internal, single-package slot: a named global survives dev HMR without a cross-package collision.
declare global {
  var __payloadRevalidateObserver: Registry | undefined
}

const registry = (): Registry => {
  const existing = globalThis.__payloadRevalidateObserver
  if (existing) return existing
  const created: Registry = { reads: new Map(), events: [] }
  globalThis.__payloadRevalidateObserver = created
  return created
}

export const recordRead = (observe: boolean, read: Omit<ObservedRead, 'firstAt' | 'lastAt' | 'count'>): void => {
  if (!observe) return
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

export const recordEvent = (observe: boolean, event: Omit<RevalidateEvent, 'at'>): void => {
  if (!observe) return
  const { events } = registry()
  events.push({ ...event, at: new Date().toISOString() })
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

export const getObservations = (): { reads: ObservedRead[]; events: RevalidateEvent[] } => {
  const { reads, events } = registry()
  return { reads: [...reads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)), events: [...events].reverse() }
}

export const resetObservations = (): void => {
  const { reads, events } = registry()
  reads.clear()
  events.length = 0
}
