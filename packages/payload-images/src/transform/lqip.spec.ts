import { describe, expect, it, vi } from 'vitest'

import { clampLqipQuality, LQIP_HARD_MAX_WIDTH, resolveLqipWidth } from './lqip'

describe('resolveLqipWidth', () => {
  it('falls back to the default when no (or an invalid) width is requested', () => {
    expect(resolveLqipWidth(undefined, 24, 64, false)).toBe(24)
    expect(resolveLqipWidth(undefined, 24, 64, true)).toBe(24)
    expect(resolveLqipWidth(0, 24, 64, false)).toBe(24)
    expect(resolveLqipWidth(-5, 24, 64, true)).toBe(24)
  })

  it('trusted (component) honors the requested width up to the hard typo guard, warning (dev-only) when the guard clamps', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveLqipWidth(48, 24, 64, false)).toBe(48)
    expect(resolveLqipWidth(120, 24, 64, false)).toBe(120) // honored past maxWidth — feedback is a dev warning, not a silent cap
    expect(warn).not.toHaveBeenCalled() // honored widths are silent
    expect(resolveLqipWidth(9999, 24, 64, false)).toBe(LQIP_HARD_MAX_WIDTH) // typo guard
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('9999'))
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining(String(LQIP_HARD_MAX_WIDTH)))
    expect(resolveLqipWidth(2, 24, 64, false)).toBe(8) // min
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('untrusted (external door) clamps to maxWidth and snaps to a /8 grid', () => {
    expect(resolveLqipWidth(48, 24, 64, true)).toBe(48)
    expect(resolveLqipWidth(200, 24, 64, true)).toBe(64) // clamped to the ceiling
    expect(resolveLqipWidth(50, 24, 64, true)).toBe(48) // snapped (round 50/8 → 48)
    expect(resolveLqipWidth(1, 24, 64, true)).toBe(8) // min
  })
})

describe('clampLqipQuality', () => {
  it('clamps to 20–70 and falls back to the default', () => {
    expect(clampLqipQuality(undefined, 40)).toBe(40)
    expect(clampLqipQuality(50, 40)).toBe(50)
    expect(clampLqipQuality(5, 40)).toBe(20)
    expect(clampLqipQuality(95, 40)).toBe(70)
  })
})
