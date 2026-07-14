import type { CollectionAfterChangeHook } from 'payload'

import { bust } from '../../lib/bust'
import { docRecord, isId } from '../../lib/values'
import { extractOnValues } from '../../lib/diff/joins'
import { anyChanged, changedFields } from '../../lib/diff/changedFields'
import { aliasOf, allListTags, docTags, extraTagBusts, joinTags, listTags, ruleTags } from './busts'
import type { Bust, CollectionHookInput, JoinMembership, Lanes, RevalidateEvent, Tags } from '../../types'

const joinMembershipBusts = (
  tags: Tags,
  slug: string,
  joinRules: JoinMembership[],
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
  changed: Set<string> | null,
  docs: { doc: unknown; previousDoc: unknown },
  lanes: Lanes,
): Bust[] => {
  const busts: Bust[] = []
  for (const { on, determinants } of joinRules) {
    const oldParents = extractOnValues(previous, on)
    const newParents = extractOnValues(current, on)
    const before = new Set(oldParents)
    const after = new Set(newParents)
    const affected = new Set<string | number>()
    for (const parent of oldParents) if (!after.has(parent)) affected.add(parent)
    for (const parent of newParents) if (!before.has(parent)) affected.add(parent)
    if (determinants.length && anyChanged(changed, determinants, docs))
      for (const parent of [...oldParents, ...newParents]) affected.add(parent)
    for (const parent of affected) busts.push(...joinTags(tags, slug, on, parent, lanes))
  }
  return busts
}

export const createAfterChange =
  ({ slug, settings, rules, tags, observe, diffSchema, joinRules = [] }: CollectionHookInput): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req: { context } }) => {
    if (context.disableRevalidate) return doc

    const current = docRecord(doc)
    const previous = docRecord(previousDoc)
    const id = current.id
    const changed = changedFields(current, previousDoc, diffSchema)
    const docs = { doc: current, previousDoc: previous }

    const status = current._status
    const wasPublished = previous._status === 'published'
    const isDraftSave = typeof status === 'string' && status !== 'published'
    const publishedToDraft = isDraftSave && wasPublished
    const isPublish = !isDraftSave && typeof status === 'string' && previousDoc != null && !wasPublished
    const trashTransition = previousDoc != null && (current.deletedAt != null) !== (previous.deletedAt != null)
    const membership = operation === 'create' || isPublish || publishedToDraft || trashTransition

    const alias = aliasOf(current, settings.idField)
    const previousAlias = aliasOf(previous, settings.idField)
    const aliasChanged = previousAlias !== undefined && previousAlias !== alias

    const operationName: RevalidateEvent['trigger']['operation'] = operation === 'create' ? 'create' : isPublish ? 'publish' : 'update'

    const lanes: Lanes = isDraftSave && !publishedToDraft ? 'draft' : 'both'

    const busts: Bust[] = []
    if (isId(id)) busts.push(...docTags(tags, slug, id, 'doc', lanes))
    if (alias !== undefined) busts.push(...docTags(tags, slug, alias, 'alias', lanes))
    if (aliasChanged && previousAlias !== undefined) busts.push(...docTags(tags, slug, previousAlias, 'alias', lanes))

    if (membership) {
      busts.push(...allListTags(tags, slug, settings, lanes))
    } else {
      for (const [scope, fields] of Object.entries(settings.lists)) {
        if (anyChanged(changed, fields, docs)) busts.push(...listTags(tags, slug, scope, lanes))
      }
    }

    if (joinRules.length) busts.push(...joinMembershipBusts(tags, slug, joinRules, current, previous, changed, docs, lanes))

    busts.push(...extraTagBusts(settings.extraTags, lanes))
    if (lanes === 'both') busts.push(...ruleTags(slug, rules, { changed, membership, docs }))

    await bust(
      busts,
      { slug, id: isId(id) ? id : undefined, operation: operationName, lane: isDraftSave ? 'draft' : 'published' },
      'hook',
      observe,
    )
    return doc
  }
