import type { CollectionAfterDeleteHook } from 'payload'

import { bust } from '../../lib/bust'
import { extractOnValues } from '../../lib/diff/joins'
import { docRecord, isId } from '../../lib/values'
import type { Bust, CollectionHookInput, JoinMembership, Tags } from '../../types'
import { aliasOf, allListTags, docTags, extraTagBusts, joinTags, ruleTags } from './busts'

/** Delete side: the parents a child *was* a member of lose it from every lane. */
const deleteJoinBusts = (tags: Tags, slug: string, joinRules: JoinMembership[], doc: Record<string, unknown>): Bust[] =>
  joinRules.flatMap(({ on }) => extractOnValues(doc, on).flatMap((parent) => joinTags(tags, slug, on, parent, 'both')))

export const createAfterDelete =
  ({ slug, settings, rules, tags, observe, joinRules = [] }: CollectionHookInput): CollectionAfterDeleteHook =>
  async ({ doc, req: { context } }) => {
    if (context.disableRevalidate) return doc

    const current = docRecord(doc)
    const id = current.id
    const alias = aliasOf(current, settings.idField)

    const busts: Bust[] = [
      ...(isId(id) ? docTags(tags, slug, id, 'doc', 'both') : []),
      ...(alias !== undefined ? docTags(tags, slug, alias, 'alias', 'both') : []),
      ...allListTags(tags, slug, settings, 'both'),
      ...deleteJoinBusts(tags, slug, joinRules, current),
      ...extraTagBusts(settings.extraTags, 'both'),
      ...ruleTags(slug, rules, { changed: null, membership: true }),
    ]

    await bust(busts, { slug, id: isId(id) ? id : undefined, operation: 'delete', lane: 'published' }, 'hook', observe)
    return doc
  }
