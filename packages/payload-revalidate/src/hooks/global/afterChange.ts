import type { GlobalAfterChangeHook } from 'payload'

import { bust } from '../../lib/bust'
import { docRecord } from '../../lib/values'
import type { Bust, Tags } from '../../types'

export const createGlobalAfterChange =
  (slug: string, { tags, observe }: { tags: Tags; observe: boolean }): GlobalAfterChangeHook =>
  async ({ doc, previousDoc, req: { context } }) => {
    if (context.disableRevalidate) return doc

    const status = docRecord(doc)._status
    const wasPublished = docRecord(previousDoc)._status === 'published'
    const isDraftSave = typeof status === 'string' && status !== 'published' && !wasPublished

    const busts: Bust[] = [
      ...(isDraftSave ? [] : [{ tag: tags.global(slug), reason: 'global' as const }]),
      { tag: tags.global(slug, { draft: true }), reason: 'global' as const },
    ]

    await bust(busts, { slug, operation: 'update', lane: isDraftSave ? 'draft' : 'published' }, 'hook', observe)
    return doc
  }
