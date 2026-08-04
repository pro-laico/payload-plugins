import { describe, expect, it } from 'vitest'

import { stepWidths } from '../../../src/lib/urls/srcset'
import { deriveStrategyWidths, reachableWidths } from '../../../src/lib/prewarm/deriveWidths'
import { DEFAULT_CONSTRAINTS, DEFAULT_WIDTH_LADDER } from '../../../src/lib/transform/params'
import type { TransformConstraints } from '../../../src/types'

const ladder: TransformConstraints = { ...DEFAULT_CONSTRAINTS, widthLadder: DEFAULT_WIDTH_LADDER }

describe('reachableWidths', () => {
  it('is the snap grid unioned with the width ladder, ascending and deduped', () => {
    const widths = reachableWidths(ladder)
    expect(widths[0]).toBe(50)
    expect(widths).toContain(828) // ladder rung off the 50px grid
    expect(widths).toContain(1200) // on both — appears once
    expect(widths.filter((w) => w === 1200)).toHaveLength(1)
    expect(widths.at(-1)).toBe(4096) // the clamp target itself
    expect([...widths].sort((a, b) => a - b)).toEqual(widths)
  })

  it('is just the grid plus the max when no ladder is configured', () => {
    const widths = reachableWidths(DEFAULT_CONSTRAINTS)
    expect(widths).toContain(50)
    expect(widths).toContain(4050)
    expect(widths).toContain(4096)
    expect(widths).not.toContain(828)
  })
})

describe('deriveStrategyWidths', () => {
  it("'srcset' matches stepWidths byte for byte — for array and numeric pixelStep alike", () => {
    expect(deriveStrategyWidths('srcset', 2400, ladder)).toEqual(stepWidths(2400, DEFAULT_WIDTH_LADDER, ladder.maxDimension))
    expect(deriveStrategyWidths('srcset', 2400, DEFAULT_CONSTRAINTS)).toEqual(
      stepWidths(2400, DEFAULT_CONSTRAINTS.dimensionStep, DEFAULT_CONSTRAINTS.maxDimension),
    )
  })

  it('{ every: 1 } is every reachable width the source supports', () => {
    expect(deriveStrategyWidths({ every: 1 }, 2400, ladder)).toEqual(reachableWidths(ladder).filter((w) => w <= 2400))
  })

  it('{ every: n } samples descending from the top, so the largest width always survives', () => {
    const all = reachableWidths(ladder).filter((w) => w <= 2400)
    const sampled = deriveStrategyWidths({ every: 2 }, 2400, ladder)
    expect(sampled).toHaveLength(Math.ceil(all.length / 2))
    expect(sampled.at(-1)).toBe(2400)
    expect(sampled).not.toContain(2350)
    expect([...sampled].sort((a, b) => a - b)).toEqual(sampled)
  })

  it('a source narrower than every rung still yields its own width', () => {
    expect(deriveStrategyWidths('srcset', 100, ladder)).toEqual([100])
    expect(deriveStrategyWidths({ every: 2 }, 100, ladder)).toEqual([100])
  })

  it('an unknown source width caps at maxDimension', () => {
    expect(deriveStrategyWidths({ every: 1 }, undefined, ladder)).toContain(4096)
  })

  it('explicit widths pass through untouched — the compute loop replays them through the snap', () => {
    expect(deriveStrategyWidths([320, 999], 2400, ladder)).toEqual([320, 999])
  })
})
