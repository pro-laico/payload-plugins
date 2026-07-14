import type { ObservedRead, Registry, RevalidateEvent } from '../../types'

const MAX_READS = 500
const MAX_EVENTS = 200

const REGISTRY_SLOT = Symbol.for('pro-laico.payload-revalidate.observer')

const registry = (): Registry => {
  const slot = globalThis as Record<symbol, unknown> //TODO: replace `as` cast with proper typing
  if (!slot[REGISTRY_SLOT]) slot[REGISTRY_SLOT] = { reads: new Map(), events: [] } satisfies Registry
  return slot[REGISTRY_SLOT] as Registry //TODO: replace `as` cast with proper typing
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
