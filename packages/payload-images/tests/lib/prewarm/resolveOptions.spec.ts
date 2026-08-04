import { describe, expect, it } from 'vitest'

import { DEFAULT_CONSTRAINTS } from '../../../src/lib/transform/params'
import { resolvePrewarmOptions } from '../../../src/lib/prewarm/resolveOptions'
import type { PrewarmOptions, TransformConstraints } from '../../../src/types'

const constraints = DEFAULT_CONSTRAINTS
const resolve = (opts: false | PrewarmOptions, c: TransformConstraints = constraints) => resolvePrewarmOptions(opts, c)

// resolve() returns `false | ResolvedPrewarmOptions`; narrow to the options for the enabled-path assertions
// (`?.` would not guard the `false` case, only nullish).
const on = (r: ReturnType<typeof resolve>) => {
  if (r === false) throw new Error('expected prewarm to resolve to options, got false')
  return r
}

describe('resolvePrewarmOptions strategy', () => {
  // Zero-config constraints carry no widthLadder (the default pixelStep is the 50px grid), so the
  // default width axis is the every-5th skeleton; an array pixelStep flips it to 'srcset'.
  const defaults = {
    widths: { every: 5 },
    builtIns: true,
    learned: true,
    seeds: [{ aspectRatio: '1:1', quality: 80 }],
    onUpload: true,
    autoRun: false,
    queue: 'default',
  }

  it("fills the default strategy for {}, strategy: 'default', and an empty strategy config alike", () => {
    expect(on(resolve({})).strategy).toEqual(defaults)
    expect(on(resolve({ strategy: 'default' })).strategy).toEqual(defaults)
    expect(on(resolve({ strategy: {} })).strategy).toEqual(defaults)
  })

  it("defaults widths to 'srcset' when the constraints carry a width ladder (array pixelStep)", () => {
    const r = on(resolve({}, { ...constraints, widthLadder: [640, 1280] }))
    expect(r.strategy.widths).toBe('srcset')
  })

  it('declared seeds REPLACE the default square seed; an explicit [] disables seeding', () => {
    const declared = on(resolve({ strategy: { seeds: [{ aspectRatio: '16:9', quality: 80 }] } }))
    expect(declared.strategy.seeds).toEqual([{ aspectRatio: '16:9', quality: 80 }])
    expect(on(resolve({ strategy: { seeds: [] } })).strategy.seeds).toEqual([])
  })

  it('honors per-field overrides without disturbing the rest', () => {
    const r = on(resolve({ strategy: { widths: { every: 2 }, autoRun: '0 3 * * *', queue: 'warmQ', onUpload: false } }))
    expect(r.strategy).toEqual({ ...defaults, widths: { every: 2 }, autoRun: '0 3 * * *', queue: 'warmQ', onUpload: false })
  })

  it('defaults the per-image cap to 32, overridable at the top level', () => {
    expect(on(resolve({})).maxVariantsPerImage).toBe(32)
    expect(on(resolve({ maxVariantsPerImage: 8 })).maxVariantsPerImage).toBe(8)
  })
})

describe('resolvePrewarmOptions formats', () => {
  it('defaults to webp, adding avif when the transform prefers it', () => {
    const base = resolve({})
    expect(on(base).formats).toEqual(['webp'])
    const avif = resolve({}, { ...constraints, preferAvif: true })
    expect(on(avif).formats).toEqual(['webp', 'avif'])
  })

  it('drops formats the transform endpoint can never serve, and reports them', () => {
    const c: TransformConstraints = { ...constraints, formats: ['auto', 'webp', 'jpeg'] }
    const r = resolve({ formats: ['avif', 'webp'] }, c)
    expect(on(r).formats).toEqual(['webp'])
    expect(on(r).droppedFormats).toEqual(['avif'])
  })

  it('falls back to servable defaults when every requested format is unservable', () => {
    const c: TransformConstraints = { ...constraints, formats: ['auto', 'webp', 'jpeg'] }
    const r = resolve({ formats: ['avif'] }, c)
    expect(on(r).formats).toEqual(['webp'])
    expect(on(r).droppedFormats).toEqual(['avif'])
  })

  it('honors an explicit empty array as "no format expansion" instead of substituting defaults', () => {
    const r = resolve({ formats: [] })
    expect(on(r).formats).toEqual([])
    expect(on(r).droppedFormats).toEqual([])
  })

  it('prewarm: false resolves to the whole surface being off', () => {
    expect(resolve(false)).toBe(false)
  })
})
