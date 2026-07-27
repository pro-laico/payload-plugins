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
