import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stashState } from '../../../src/lib/state'
import { getObservations, recordEvent, recordRead, resetObservations } from '../../../src/lib/observe/registry'

const read = (as: string, extra: Partial<Parameters<typeof recordRead>[0]> = {}) =>
  recordRead({ kind: 'doc', collection: 'posts', as, draft: false, staticTags: ['posts:1'], depTags: [], bakedIn: [], capped: false, ...extra })

const event = (slug: string) =>
  recordEvent({ source: 'hook', trigger: { slug, operation: 'update', lane: 'published' }, busted: [{ tag: slug, reason: 'list' }] })

describe('observe/registry', () => {
  beforeEach(() => {
    stashState({ prefix: '', observe: true })
    resetObservations()
  })
  afterEach(() => stashState({ prefix: '', observe: false }))

  it('records reads and dedupes repeat materializations by shape', () => {
    read('a')
    read('a')
    read('b')
    const { reads } = getObservations()
    expect(reads).toHaveLength(2)
    expect(reads.find((r) => r.as === 'a')?.count).toBe(2)
  })

  it('keeps events newest-first and caps the ring buffer at 200', () => {
    for (let i = 0; i < 205; i++) event(`c${i}`)
    const { events } = getObservations()
    expect(events).toHaveLength(200)
    expect(events[0]?.trigger.slug).toBe('c204')
    expect(events.at(-1)?.trigger.slug).toBe('c5')
  })

  it('is a no-op when observation is off', () => {
    stashState({ prefix: '', observe: false })
    read('a')
    event('posts')
    expect(getObservations()).toEqual({ reads: [], events: [] })
  })

  it('eviction at the cap is LRU — a re-materializing read is never the one dropped', () => {
    read('hot') // inserted first, but touched again below
    for (let i = 0; i < 499; i++) read(`cold${i}`)
    read('hot') // refresh recency at the cap
    read('newcomer') // 501st shape — evicts the LEAST recently touched, not 'hot'
    const reads = getObservations().reads
    expect(reads).toHaveLength(500)
    expect(reads.find((r) => r.as === 'hot')?.count).toBe(2)
    expect(reads.find((r) => r.as === 'cold0')).toBeUndefined()
  })
})
