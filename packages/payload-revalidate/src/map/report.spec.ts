import type { CollectionConfig } from 'payload'
import { describe, expect, it } from 'vitest'
import type { RevalidateInspection } from '../lib/inspect'
import { buildStaticInspection } from './build'
import { renderRevalidateMap } from './report'

const posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'slug', type: 'text' },
    { name: 'author', type: 'relationship', relationTo: 'authors' },
    { name: 'hero', type: 'upload', relationTo: 'media' },
  ],
}
const authors: CollectionConfig = { slug: 'authors', fields: [{ name: 'name', type: 'text' }] }
const media: CollectionConfig = { slug: 'media', upload: true, fields: [] }

const fixture = (custom?: Record<string, unknown>): RevalidateInspection =>
  buildStaticInspection({ collections: [posts, authors, media], custom })

describe('renderRevalidateMap', () => {
  it('renders a self-contained Markdown map', () => {
    const md = renderRevalidateMap(fixture())
    expect(md).toContain('# Revalidation map')
    expect(md).toContain('## Tag vocabulary')
    expect(md).toContain('### posts')
    expect(md).toContain('## Reference graph (every edge)')
    // The blast-radius direction is spelled out per collection.
    expect(md).toContain('A write here makes these stale') // media is embedded by posts
    expect(md).toContain('Goes stale when these change') // posts embeds media/authors
  })

  it('applies the namespace prefix to every example tag', () => {
    const md = renderRevalidateMap(fixture({ payloadRevalidate: { options: { prefix: 'shop' }, endpointPath: null } }))
    expect(md).toContain('namespace `shop`')
    expect(md).toContain('`shop:authors:42`') // vocabulary example uses the first tracked slug
    expect(md).toContain('`shop:posts`') // list tag under the posts section
    expect(md).toContain('`shop:all`')
  })

  it('lists declared list scopes and their determinant fields', () => {
    const md = renderRevalidateMap(
      fixture({
        payloadRevalidate: {
          options: { collections: { posts: { lists: { recent: { fields: ['publishedAt'] } } } } },
          endpointPath: null,
        },
      }),
    )
    expect(md).toContain('`posts:list:recent`')
    expect(md).toContain('`publishedAt`')
  })

  it('renders manual dependency rules', () => {
    const md = renderRevalidateMap(
      fixture({ payloadRevalidate: { options: { rules: [{ on: 'authors', bust: ['posts'], whenFields: ['name'] }] }, endpointPath: null } }),
    )
    expect(md).toContain('## Manual dependency rules')
    expect(md).toContain('on `authors` → bust `posts`')
    expect(md).toContain('when `name` change')
  })
})
