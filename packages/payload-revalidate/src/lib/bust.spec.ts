import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getObservations, resetObservations } from '../observe/registry'
import { stashState } from '../tags'
import { bust, safeRevalidate } from './bust'

const revalidateTag = vi.fn()
const updateTag = vi.fn()
let updateTagAvailable = false
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  // Getter so each test controls whether the running Next "exports" updateTag.
  get updateTag() {
    return updateTagAvailable ? (...args: unknown[]) => updateTag(...args) : undefined
  },
}))

describe('lib/bust', () => {
  beforeEach(() => {
    stashState({ prefix: '', observe: true })
    resetObservations()
    revalidateTag.mockReset()
    updateTag.mockReset()
    updateTagAvailable = false
  })
  afterEach(() => stashState({ prefix: '', observe: false }))

  it('busts each unique tag with expire-now semantics (single-arg revalidateTag)', async () => {
    await bust(
      [
        { tag: 'posts:1', reason: 'doc' },
        { tag: 'posts:1', reason: 'doc' },
        { tag: 'posts', reason: 'list' },
      ],
      { slug: 'posts', id: 1, operation: 'update', lane: 'published' },
      'hook',
    )
    expect(revalidateTag.mock.calls).toEqual([['posts:1'], ['posts']])
  })

  it('prefers updateTag when the context accepts it (server actions) — no revalidateTag call', async () => {
    updateTagAvailable = true
    await safeRevalidate('posts:1')
    expect(updateTag).toHaveBeenCalledWith('posts:1')
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('falls back to revalidateTag when updateTag rejects the context (route handlers)', async () => {
    updateTagAvailable = true
    updateTag.mockImplementation(() => {
      throw new Error('updateTag can only be called from within a Server Action.')
    })
    await safeRevalidate('posts:1')
    expect(revalidateTag).toHaveBeenCalledWith('posts:1')
  })

  it("filters Next's single-arg deprecation nag but passes other warnings through", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    revalidateTag.mockImplementation(() => {
      console.warn('"revalidateTag" without the second argument is now deprecated, add second argument of "max" or use "updateTag".')
      console.warn('some other warning')
    })
    await safeRevalidate('posts')
    expect(warn.mock.calls.map((c) => c[0])).toEqual(['some other warning'])
    warn.mockRestore()
  })

  it('records the event before busting, with deduped reasons', async () => {
    await bust([{ tag: 'posts', reason: 'list' }], { slug: 'posts', operation: 'create', lane: 'published' }, 'hook')
    const { events } = getObservations()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      source: 'hook',
      trigger: { slug: 'posts', operation: 'create' },
      busted: [{ tag: 'posts', reason: 'list' }],
    })
  })

  it('records nothing and busts nothing for an empty bust list', async () => {
    await bust([], { slug: 'posts', operation: 'update', lane: 'published' }, 'hook')
    expect(getObservations().events).toHaveLength(0)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('swallows revalidateTag errors (no request scope)', async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('Route /x used "revalidateTag" outside a request scope: static generation store missing')
    })
    await expect(safeRevalidate('posts')).resolves.toBeUndefined()
  })
})
