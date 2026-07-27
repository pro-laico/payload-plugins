import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { authedRequest, isAllowed, publicRequest } from '../../plugin-kit/src/endpointAccess'

// The one primitive all 7 plugins gate their endpoints through. Its `explicit-false-honored`
// subtlety (a consumer gate returning false must NOT fall through to the default) is exactly the
// kind of thing a plugin author would get wrong re-rolling it — so it's pinned here once.

const req = (user: unknown): PayloadRequest => ({ user }) as unknown as PayloadRequest

describe('endpoint access primitives', () => {
  it('authedRequest allows any logged-in user, denies anonymous', () => {
    expect(authedRequest(req({ id: '1' }))).toBe(true)
    expect(authedRequest(req(null))).toBe(false)
  })

  it('publicRequest always allows', () => {
    expect(publicRequest(req(null))).toBe(true)
    expect(publicRequest(req({ id: '1' }))).toBe(true)
  })

  describe('isAllowed', () => {
    it('falls back to any-logged-in-user when the gate is unset', async () => {
      expect(await isAllowed(undefined, req({ id: '1' }))).toBe(true)
      expect(await isAllowed(undefined, req(null))).toBe(false)
    })

    it('uses an explicit fallback when the gate is unset', async () => {
      expect(await isAllowed(undefined, req(null), publicRequest)).toBe(true)
    })

    it('honors a consumer gate over the fallback — including an explicit false', async () => {
      // A gate returning false must deny even though the fallback (authedRequest) would allow.
      expect(await isAllowed(() => false, req({ id: '1' }))).toBe(false)
      expect(await isAllowed(() => true, req(null))).toBe(true)
    })

    it('awaits an async gate', async () => {
      expect(await isAllowed(async () => false, req({ id: '1' }))).toBe(false)
      expect(await isAllowed(async () => true, req(null))).toBe(true)
    })
  })
})
