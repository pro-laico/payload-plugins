import type { CollectionAfterDeleteHook } from 'payload'

import { bust } from '../../lib/bust'
import { extractOnValues } from '../../lib/joins'
import { docRecord, isId } from '../../lib/values'
import type { Bust, CollectionHookInput, JoinMembership } from '../../types'
import { aliasOf, allListTags, docTags, extraTagBusts, joinTags, ruleTags } from './busts'

/** Delete side: the parents a child *was* a member of lose it from every lane. */
const deleteJoinBusts = (slug: string, joinRules: JoinMembership[], doc: Record<string, unknown>): Bust[] =>
  joinRules.flatMap(({ on }) => extractOnValues(doc, on).flatMap((parent) => joinTags(slug, on, parent, 'both')))

export const createAfterDelete =
  ({ slug, settings, rules, joinRules = [] }: CollectionHookInput): CollectionAfterDeleteHook =>
  async ({ doc, req: { context } }) => {
    if (context.disableRevalidate) return doc

    const current = docRecord(doc)
    const id = current.id
    const alias = aliasOf(current, settings.idField)

    const busts: Bust[] = [
      ...(isId(id) ? docTags(slug, id, 'doc', 'both') : []),
      ...(alias !== undefined ? docTags(slug, alias, 'alias', 'both') : []),
      ...allListTags(slug, settings, 'both'),
      ...deleteJoinBusts(slug, joinRules, current),
      ...extraTagBusts(settings.extraTags, 'both'),
      ...ruleTags(slug, rules, { changed: null, membership: true }),
    ]

    await bust(busts, { slug, id: isId(id) ? id : undefined, operation: 'delete', lane: 'published' }, 'hook')
    return doc
  }
