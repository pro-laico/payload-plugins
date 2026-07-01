import { describe, expect, it } from 'vitest'
import { ref } from '../refs'
import { type BuiltModel, buildGraph } from './graph'

const model = (over: Partial<BuiltModel> = {}): BuiltModel => ({
  collections: [],
  globals: [],
  ...over,
})

describe('buildGraph', () => {
  it('orders dependencies before dependents (topological)', () => {
    const graph = buildGraph(
      model({
        collections: [
          { slug: 'posts', records: [{ key: 'launch', data: { service: ref('services', 'consulting') } }] },
          { slug: 'services', records: [{ key: 'consulting', data: {} }] },
        ],
      }),
    )
    // services:consulting must come before posts:launch regardless of declaration order
    expect(graph.order.indexOf('services:consulting')).toBeLessThan(graph.order.indexOf('posts:launch'))
  })

  it('captures ref edges, including from globals', () => {
    const graph = buildGraph(
      model({
        collections: [
          { slug: 'services', records: [{ key: 'a', data: {} }] },
          { slug: 'posts', records: [{ key: 'p', data: { service: ref('services', 'a') } }] },
        ],
        globals: [{ slug: 'site', data: { featured: ref('services', 'a') } }],
      }),
    )
    expect(graph.edges).toContainEqual({ from: 'posts:p', to: 'services:a' })
    expect(graph.edges).toContainEqual({ from: 'global:site', to: 'services:a' })
    // globals are not part of the doc create order (they're updated after all docs)
    expect(graph.order).not.toContain('global:site')
  })

  it('throws on a dependency cycle, naming the cycle', () => {
    expect(() =>
      buildGraph(
        model({
          collections: [
            { slug: 'a', records: [{ key: 'x', data: { r: ref('b', 'y') } }] },
            { slug: 'b', records: [{ key: 'y', data: { r: ref('a', 'x') } }] },
          ],
        }),
      ),
    ).toThrow(/cycle detected/i)
  })

  it('handles a doc with no dependencies', () => {
    const graph = buildGraph(model({ collections: [{ slug: 'a', records: [{ key: 'x', data: { title: 'hi' } }] }] }))
    expect(graph.order).toEqual(['a:x'])
    expect(graph.edges).toHaveLength(0)
  })

  it('breaks a cycle by deferring an optional field (both docs still ordered)', () => {
    const graph = buildGraph(
      model({
        collections: [
          { slug: 'a', records: [{ key: 'x', data: { r: ref('b', 'y') } }] },
          { slug: 'b', records: [{ key: 'y', data: { r: ref('a', 'x') } }] },
        ],
      }),
      { isRequired: () => false },
    )
    expect(graph.order).toEqual(expect.arrayContaining(['a:x', 'b:y']))
    expect(graph.order).toHaveLength(2)
    expect(graph.deferred).toHaveLength(1)
    expect(['a:x', 'b:y']).toContain(graph.deferred[0]?.node)
    expect(graph.deferred[0]?.field).toBe('r')
  })

  it('breaks the cycle at the optional edge, not the required one', () => {
    // a.b is required (b must exist before a); b.a is optional, so it's the one deferred.
    const graph = buildGraph(
      model({
        collections: [
          { slug: 'a', records: [{ key: 'x', data: { b: ref('b', 'y') } }] },
          { slug: 'b', records: [{ key: 'y', data: { a: ref('a', 'x') } }] },
        ],
      }),
      { isRequired: (collection, field) => collection === 'a' && field === 'b' },
    )
    expect(graph.order.indexOf('b:y')).toBeLessThan(graph.order.indexOf('a:x'))
    expect(graph.deferred).toEqual([{ node: 'b:y', field: 'a' }])
  })

  it('defers a self-reference', () => {
    const graph = buildGraph(model({ collections: [{ slug: 'a', records: [{ key: 'x', data: { self: ref('a', 'x') } }] }] }), {
      isRequired: () => false,
    })
    expect(graph.order).toEqual(['a:x'])
    expect(graph.deferred).toEqual([{ node: 'a:x', field: 'self' }])
  })

  it('still throws when every field in the cycle is required', () => {
    expect(() =>
      buildGraph(
        model({
          collections: [
            { slug: 'a', records: [{ key: 'x', data: { r: ref('b', 'y') } }] },
            { slug: 'b', records: [{ key: 'y', data: { r: ref('a', 'x') } }] },
          ],
        }),
        { isRequired: () => true },
      ),
    ).toThrow(/cycle detected/i)
  })
})
