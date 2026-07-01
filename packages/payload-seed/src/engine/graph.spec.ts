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
})
