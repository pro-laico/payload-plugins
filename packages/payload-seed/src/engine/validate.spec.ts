import { describe, expect, it } from 'vitest'
import { file, ref } from '../refs'
import type { BuiltModel } from './graph'
import { SeedValidationError, validateModel } from './validate'

const slugs = new Set(['services', 'posts', 'media'])
const fileCollections = new Set(['media'])

const run = (model: BuiltModel) => validateModel({ model, collectionSlugs: slugs, fileCollections })

describe('validateModel', () => {
  it('passes when every ref resolves', () => {
    expect(() =>
      run({
        collections: [
          { slug: 'services', records: [{ key: 'a', data: {} }] },
          { slug: 'posts', records: [{ key: 'p', data: { service: ref('services', 'a') } }] },
        ],
        globals: [],
      }),
    ).not.toThrow()
  })

  it('flags a ref to a non-existent _key (dangling reference)', () => {
    expect(() =>
      run({
        collections: [{ slug: 'posts', records: [{ key: 'p', data: { service: ref('services', 'ghost') } }] }],
        globals: [],
      }),
    ).toThrow(/no seeded 'services' doc has _key 'ghost'/)
  })

  it('flags a ref to an unknown collection', () => {
    expect(() =>
      run({
        collections: [{ slug: 'posts', records: [{ key: 'p', data: { x: ref('widgets' as never, 'a') } }] }],
        globals: [],
      }),
    ).toThrow(/unknown collection 'widgets'/)
  })

  it('allows a _file on an upload/asset collection', () => {
    expect(() =>
      run({
        collections: [{ slug: 'media', records: [{ key: 'hero', file: file('hero.jpg'), data: { alt: 'Hero' } }] }],
        globals: [],
      }),
    ).not.toThrow()
  })

  it('flags a _file on a collection that is neither upload nor a custom.seedAsset collection', () => {
    expect(() =>
      run({
        collections: [{ slug: 'services', records: [{ key: 'a', file: file('x.jpg'), data: {} }] }],
        globals: [],
      }),
    ).toThrow(/not an upload collection or a custom\.seedAsset collection/)
  })

  it('flags duplicate _keys within a collection', () => {
    expect(() =>
      run({
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

  it('flags unknown record fields when fieldNames is supplied', () => {
    const fieldNames = new Map([['services', new Set(['title', 'slug'])]])
    expect(() =>
      validateModel({
        model: { collections: [{ slug: 'services', records: [{ key: 'a', data: { title: 'X', bogus: 'Y' } }] }], globals: [] },
        collectionSlugs: slugs,
        fileCollections,
        fieldNames,
      }),
    ).toThrow(/unknown field 'bogus'/)
  })

  it('allows `_status` and known fields; skips the check without fieldNames', () => {
    const model: BuiltModel = {
      collections: [{ slug: 'services', records: [{ key: 'a', data: { title: 'X', _status: 'draft' } }] }],
      globals: [],
    }
    expect(() =>
      validateModel({ model, collectionSlugs: slugs, fileCollections, fieldNames: new Map([['services', new Set(['title'])]]) }),
    ).not.toThrow()
    expect(() => run(model)).not.toThrow() // no fieldNames → field check skipped
  })

  it('aggregates multiple issues into one SeedValidationError', () => {
    try {
      run({
        collections: [{ slug: 'posts', records: [{ key: 'p', file: file('x.jpg'), data: { a: ref('services', 'ghost') } }] }],
        globals: [],
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(SeedValidationError)
      // a dangling ref + a _file on a non-file collection
      expect((e as SeedValidationError).issues.length).toBe(2)
    }
  })
})
