import { bust } from '../lib/bust'
import { getState } from '../lib/state'
import { tags } from '../lib/tags'

/** The manual busters — for flows outside the auto-attached hooks. */

/** Manually bust one doc's tags (both lanes) — for flows outside the auto hooks. */
export const revalidateDoc = (slug: string, id: string | number): Promise<void> =>
  bust(
    [
      { tag: tags.doc(slug, id), reason: 'doc' },
      { tag: tags.doc(slug, id, { draft: true }), reason: 'doc' },
    ],
    { slug, id, operation: 'manual', lane: 'published' },
    'manual',
  )

/** Manually bust a collection's list tags — bare + every declared scope, both lanes. */
export const revalidateList = (slug: string): Promise<void> =>
  bust(
    [undefined, ...(getState().lists?.[slug] ?? [])].flatMap((scope) => [
      { tag: tags.list(slug, { scope }), reason: 'list' as const },
      { tag: tags.list(slug, { scope, draft: true }), reason: 'list' as const },
    ]),
    { slug, operation: 'manual', lane: 'published' },
    'manual',
  )

/** Manually bust a global's tags (both lanes). */
export const revalidateGlobal = (slug: string): Promise<void> =>
  bust(
    [
      { tag: tags.global(slug), reason: 'global' },
      { tag: tags.global(slug, { draft: true }), reason: 'global' },
    ],
    { slug, operation: 'manual', lane: 'published' },
    'manual',
  )

/** Bust every entry the `./cache` helpers tagged — they all carry `all`. */
export const revalidateAll = (): Promise<void> =>
  bust([{ tag: tags.all(), reason: 'all' }], { slug: 'all', operation: 'manual', lane: 'published' }, 'manual')
