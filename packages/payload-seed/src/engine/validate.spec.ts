import { describe, expect, it } from 'vitest'
import { asset, ref } from '../refs'
import type { BuiltModel } from './graph'
import { SeedValidationError, validateModel } from './validate'

const slugs = new Set(['services', 'posts'])

const run = (model: BuiltModel) => validateModel({ model, collectionSlugs: slugs })

describe('validateModel', () => {
  it('passes when every ref/asset resolves', () => {
    expect(() =>
      run({
        assetKeys: ['hero'],
        collections: [
          { slug: 'services', records: [{ key: 'a', data: { image: asset('hero') } }] },
          { slug: 'posts', records: [{ key: 'p', data: { service: ref('services', 'a') } }] },
        ],
        globals: [],
      }),
    ).not.toThrow()
  })

  it('flags a ref to a non-existent _key (dangling reference)', () => {
    expect(() =>
      run({
        assetKeys: [],
        collections: [{ slug: 'posts', records: [{ key: 'p', data: { service: ref('services', 'ghost') } }] }],
        globals: [],
      }),
    ).toThrow(/no seeded 'services' doc has _key 'ghost'/)
  })

  it('flags a ref to an unknown collection', () => {
    expect(() =>
      run({
        assetKeys: [],
        collections: [{ slug: 'posts', records: [{ key: 'p', data: { x: ref('widgets' as never, 'a') } }] }],
        globals: [],
      }),
    ).toThrow(/unknown collection 'widgets'/)
  })

  it('flags an asset key that was never declared', () => {
    expect(() =>
      run({
        assetKeys: ['hero'],
        collections: [{ slug: 'services', records: [{ key: 'a', data: { image: asset('missing') } }] }],
        globals: [],
      }),
    ).toThrow(/asset\('missing'\)/)
  })

  it('flags duplicate _keys within a collection', () => {
    expect(() =>
      run({
        assetKeys: [],
        collections: [
          {
            slug: 'services',
            records: [
              { key: 'dup', data: {} },
              { key: 'dup', data: {} },
            ],
          },
        ],
        globals: [],
      }),
    ).toThrow(/duplicate _key 'dup'/)
  })

  it('aggregates multiple issues into one SeedValidationError', () => {
    try {
      run({
        assetKeys: [],
        collections: [{ slug: 'posts', records: [{ key: 'p', data: { a: ref('services', 'ghost'), b: asset('missing') } }] }],
        globals: [],
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(SeedValidationError)
      expect((e as SeedValidationError).issues.length).toBe(2)
    }
  })
})
