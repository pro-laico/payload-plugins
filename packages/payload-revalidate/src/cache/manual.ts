import type { Payload } from 'payload'

import { bust } from '../lib/bust'
import { createTags } from '../lib/tags'
import type { CacheHelpers } from '../types'
import { readRevalidateMarker } from '../lib/marker'

export const createManualBusters = (
  handle: Payload | Promise<Payload>,
): Pick<CacheHelpers, 'revalidateDoc' | 'revalidateList' | 'revalidateGlobal' | 'revalidateAll'> => {
  const ctx = async (): Promise<{ tags: ReturnType<typeof createTags>; lists: Record<string, string[]>; observe: boolean }> => {
    const payload = await handle
    const marker = readRevalidateMarker(payload.config)
    return { tags: createTags(marker?.prefix), lists: marker?.lists ?? {}, observe: marker?.observe ?? false }
  }

  return {
    revalidateDoc: async (slug, id) => {
      const { tags, observe } = await ctx()
      await bust(
        [
          { tag: tags.doc(slug, id), reason: 'doc' },
          { tag: tags.doc(slug, id, { draft: true }), reason: 'doc' },
        ],
        { slug, id, operation: 'manual', lane: 'published' },
        'manual',
        observe,
      )
    },
    revalidateList: async (slug) => {
      const { tags, lists, observe } = await ctx()
      await bust(
        [undefined, ...(lists[slug] ?? [])].flatMap((scope) => [
          { tag: tags.list(slug, { scope }), reason: 'list' as const },
          { tag: tags.list(slug, { scope, draft: true }), reason: 'list' as const },
        ]),
        { slug, operation: 'manual', lane: 'published' },
        'manual',
        observe,
      )
    },
    revalidateGlobal: async (slug) => {
      const { tags, observe } = await ctx()
      await bust(
        [
          { tag: tags.global(slug), reason: 'global' },
          { tag: tags.global(slug, { draft: true }), reason: 'global' },
        ],
        { slug, operation: 'manual', lane: 'published' },
        'manual',
        observe,
      )
    },
    revalidateAll: async () => {
      const { tags, observe } = await ctx()
      await bust([{ tag: tags.all(), reason: 'all' }], { slug: 'all', operation: 'manual', lane: 'published' }, 'manual', observe)
    },
  }
}
