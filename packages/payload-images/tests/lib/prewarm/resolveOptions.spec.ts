import { describe, expect, it } from 'vitest'

import { DEFAULT_CONSTRAINTS } from '../../../src/lib/transform/params'
import { resolvePrewarmOptions } from '../../../src/lib/prewarm/resolveOptions'
import type { ImagesPluginOptions, TransformConstraints } from '../../../src/types'

const constraints = DEFAULT_CONSTRAINTS
const resolve = (opts: ImagesPluginOptions, c: TransformConstraints = constraints) => resolvePrewarmOptions(opts, c)

describe('resolvePrewarmOptions formats', () => {
  it('defaults to webp, adding avif when the transform prefers it', () => {
    const base = resolve({ prewarm: true })
    expect(base && base.formats).toEqual(['webp'])
    const avif = resolve({ prewarm: true }, { ...constraints, preferAvif: true })
    expect(avif && avif.formats).toEqual(['webp', 'avif'])
  })

  it('drops formats the transform endpoint can never serve, and reports them', () => {
    const c: TransformConstraints = { ...constraints, formats: ['auto', 'webp', 'jpeg'] }
    const r = resolve({ prewarm: { formats: ['avif', 'webp'] } }, c)
    expect(r && r.formats).toEqual(['webp'])
    expect(r && r.droppedFormats).toEqual(['avif'])
  })

  it('falls back to servable defaults when every requested format is unservable', () => {
    const c: TransformConstraints = { ...constraints, formats: ['auto', 'webp', 'jpeg'] }
    const r = resolve({ prewarm: { formats: ['avif'] } }, c)
    expect(r && r.formats).toEqual(['webp'])
    expect(r && r.droppedFormats).toEqual(['avif'])
  })

  it('honors an explicit empty array as "no format expansion" instead of substituting defaults', () => {
    const r = resolve({ prewarm: { formats: [] } })
    expect(r && r.formats).toEqual([])
    expect(r && r.droppedFormats).toEqual([])
  })
})
