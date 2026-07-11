import type { GlobalAfterChangeHook } from 'payload'

import { bust, type Bust } from '../../lib/bust'
import { docRecord } from '../../lib/values'
import { tags } from '../../tags'

/**
 * The write side for a global: bust `global:{slug}` lane-aware. A plain draft save
 * touches only the draft variant; a published save (or a publish/unpublish transition)
 * touches both lanes. Honors `context.disableRevalidate` like the collection hooks.
 */
export const createGlobalAfterChange =
  (slug: string): GlobalAfterChangeHook =>
  async ({ doc, previousDoc, req: { context } }) => {
    if (context.disableRevalidate) return doc

    const status = docRecord(doc)._status
    const wasPublished = docRecord(previousDoc)._status === 'published'
    const isDraftSave = typeof status === 'string' && status !== 'published' && !wasPublished

    const busts: Bust[] = [
      ...(isDraftSave ? [] : [{ tag: tags.global(slug), reason: 'global' as const }]),
      { tag: tags.global(slug, { draft: true }), reason: 'global' as const },
    ]

    await bust(busts, { slug, operation: 'update', lane: isDraftSave ? 'draft' : 'published' }, 'hook')
    return doc
  }
