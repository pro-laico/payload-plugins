import { describe, expect, it } from 'vitest'
import { createOnce } from './once'

describe('createOnce', () => {
  it('returns true the first time a key is seen, false thereafter', () => {
    const once = createOnce()
    expect(once('a')).toBe(true)
    expect(once('a')).toBe(false)
    expect(once('a')).toBe(false)
  })

  it('tracks distinct keys independently', () => {
    const once = createOnce()
    expect(once('a')).toBe(true)
    expect(once('b')).toBe(true)
    expect(once('a')).toBe(false)
    expect(once('b')).toBe(false)
  })

  it('gives each registry its own key space', () => {
    const a = createOnce()
    const b = createOnce()
    expect(a('x')).toBe(true)
    expect(b('x')).toBe(true) // independent registry — not deduped against `a`
  })
})
