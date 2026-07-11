import type { CollectionAfterChangeHook } from 'payload'

import { bust, type Bust } from '../../lib/bust'
import { anyChanged, changedFields } from '../../lib/changedFields'
import { extractOnValues, type JoinMembership } from '../../lib/joins'
import { docRecord, isId } from '../../lib/values'
import type { RevalidateEvent } from '../../observe/registry'
import { aliasOf, allListTags, type CollectionHookInput, docTags, extraTagBusts, joinTags, type Lanes, listTags, ruleTags } from './busts'

/**
 * The write side: one afterChange + one afterDelete per collection, computing the blast
 * radius from WHICH FIELDS changed — the atomic decision table:
 *
 * | Event                                    | doc tags (id + alias) | list tags | lanes |
 * | ---------------------------------------- | --------------------- | --------- | ----- |
 * | content-only edit (the common case)      | ✅                    | —         | both  |
 * | edit touching a scope's declared fields¹ | ✅                    | just those scopes | both |
 * | membership event²                        | ✅                    | bare + ALL scopes | both |
 * | draft save (draft → draft)               | ✅ (draft lane)       | scopes whose fields changed, draft lane | draft |
 * | alias (slug) change                      | ✅ old AND new alias  | —³        | both  |
 * | delete (incl. trash / restore-from-trash)| ✅                    | bare + ALL scopes | both  |
 *
 * ¹ `settings.lists` — each scope names its membership/order determinants (sort + filter
 *   fields, dotted paths supported); an edit busts a scope only when the diff intersects.
 *   Relationship/upload values are compared by ID (Payload returns `doc` at request depth
 *   but `previousDoc` at depth 0 — a populated doc must not read as a change); joins are
 *   derived and excluded from the diff.
 * ² create, delete, publish, unpublish (published→draft — indistinguishable from a draft
 *   save over a published doc, so both lanes bust for that signature), and trash
 *   transitions (`deletedAt` set or cleared — a soft delete/restore changes list
 *   membership exactly like a delete, but arrives as an update).
 * ³ id-lists hold ids, not slugs — an alias change re-renders the doc's own entries via
 *   the doc tag; list membership/order is untouched.
 *
 * `extraTags` follow the lanes: published-surface writes bust the base tag (draft reads
 * carry it too), draft saves bust only the `:draft` variants. Dependency `rules` fire on
 * published-surface writes when their `whenFields` changed — OR on any membership event,
 * because a publish's field delta may have arrived across earlier (rule-skipped) draft
 * saves and be invisible to the publish-time diff. Deletes fire rules unconditionally.
 * Every path honors `context.disableRevalidate` (the repo-wide opt-out the seed engine
 * sets) and reports through `lib/bust.ts`, so the dev map logs the event with per-tag
 * reasons.
 *
 * On top of the table, a write also busts JOIN MEMBERSHIP for any join this collection is
 * the child of: a `posts` write moves the membership of the `category` whose join renders
 * "all my posts". A join is a live query with no stable id, so create/delete/reassign
 * changes the list with none of the current members changing — surgically handled by
 * {@link joinMembershipBusts}/{@link deleteJoinBusts}, which bust only the affected
 * parent(s) on the `{child}:join:{on}:{parentId}` tag their entries carry.
 */

/**
 * A write to a CHILD collection moves its parents' join membership (a `category` renders
 * "all my posts"; a join is a live query, so create/delete/reassign changes the list with
 * none of the current members changing). Surgical — bust ONLY the parents whose membership
 * actually moved, on the tag their entry carries:
 *
 * - **reassignment** — the `on` value changed: bust every parent the child left OR joined
 *   (the symmetric difference), never the ones it stayed in.
 * - **filtered membership** — a `where`-determinant changed while the parent held steady:
 *   the child may have flipped in/out of the filtered list, so bust its current parent(s).
 *
 * Create falls out of the reassignment case (no old parents → all new ones are "joined");
 * `changed === null` makes the determinant gate fire too, harmlessly hitting the same set.
 * Deletes go through {@link deleteJoinBusts} — the parents the child *was* in.
 */
const joinMembershipBusts = (
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
    for (const parent of affected) busts.push(...joinTags(slug, on, parent, lanes))
  }
  return busts
}

export const createAfterChange =
  ({ slug, settings, rules, diffSchema, joinRules = [] }: CollectionHookInput): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req: { context } }) => {
    if (context.disableRevalidate) return doc

    const current = docRecord(doc)
    const previous = docRecord(previousDoc)
    const id = current.id
    const changed = changedFields(current, previousDoc, diffSchema)
    const docs = { doc: current, previousDoc: previous }

    const status = current._status
    const isDraftSave = typeof status === 'string' && status !== 'published'
    const wasPublished = previous._status === 'published'
    // published → draft is ambiguous: an unpublish and a draft save over a published doc
    // arrive with the SAME hook signature. Both lanes bust for either reading — correct
    // for the unpublish, a harmless over-bust for the draft save.
    const publishedToDraft = isDraftSave && wasPublished
    const isPublish = !isDraftSave && typeof status === 'string' && previousDoc != null && !wasPublished
    // Trash (`trash: true`) soft-deletes via an UPDATE that sets `deletedAt` — list
    // membership changes exactly like a delete; restore is the transition back.
    const trashTransition = previousDoc != null && (current.deletedAt != null) !== (previous.deletedAt != null)
    const membership = operation === 'create' || isPublish || publishedToDraft || trashTransition

    const alias = aliasOf(current, settings.idField)
    const previousAlias = aliasOf(previous, settings.idField)
    const aliasChanged = previousAlias !== undefined && previousAlias !== alias

    const operationName: RevalidateEvent['trigger']['operation'] = operation === 'create' ? 'create' : isPublish ? 'publish' : 'update'

    // A plain draft save touches only the draft lane; publish and published→draft
    // transitions and published edits touch both (draft-lane entries show the published
    // doc too).
    const lanes: Lanes = isDraftSave && !publishedToDraft ? 'draft' : 'both'

    const busts: Bust[] = []
    if (isId(id)) busts.push(...docTags(slug, id, 'doc', lanes))
    if (alias !== undefined) busts.push(...docTags(slug, alias, 'alias', lanes))
    if (aliasChanged && previousAlias !== undefined) busts.push(...docTags(slug, previousAlias, 'alias', lanes))

    if (membership) {
      busts.push(...allListTags(slug, settings, lanes))
    } else {
      // Field-driven: only the scopes whose declared determinants actually changed.
      for (const [scope, fields] of Object.entries(settings.lists)) {
        if (anyChanged(changed, fields, docs)) busts.push(...listTags(slug, scope, lanes))
      }
    }

    if (joinRules.length) busts.push(...joinMembershipBusts(slug, joinRules, current, previous, changed, docs, lanes))

    busts.push(...extraTagBusts(settings.extraTags, lanes))
    if (lanes === 'both') busts.push(...ruleTags(slug, rules, { changed, membership, docs }))

    await bust(busts, { slug, id: isId(id) ? id : undefined, operation: operationName, lane: isDraftSave ? 'draft' : 'published' }, 'hook')
    return doc
  }
