import type { Bust } from '../../lib/bust'
import { anyChanged, type ChangeDetectionSchema } from '../../lib/changedFields'
import type { JoinMembership } from '../../lib/joins'
import { isId } from '../../lib/values'
import type { CollectionSettings } from '../../options'
import { tags } from '../../tags'
import type { DependencyRule } from '../../types'

/** Shared bust-builders for the collection write side — the leaf both {@link createAfterChange}
 *  and {@link createAfterDelete} import (never the reverse), keeping the graph acyclic. */

export interface CollectionHookInput {
  slug: string
  settings: CollectionSettings
  rules: DependencyRule[]
  /** Diff normalization derived from the collection's schema — see {@link ChangeDetectionSchema}. */
  diffSchema?: ChangeDetectionSchema
  /** Joins for which THIS collection is the child (member) side — a write here moves the
   *  parent's join membership. See {@link JoinMembership} and {@link joinMembershipBusts}. */
  joinRules?: JoinMembership[]
}

export const aliasOf = (doc: Record<string, unknown>, idField: string | false): string | number | undefined => {
  if (!idField) return undefined
  const value = doc[idField]
  return isId(value) ? value : undefined
}

export type Lanes = 'both' | 'draft'

/** Doc-scoped tags for one identifier: published + draft lanes, or draft lane only. */
export const docTags = (slug: string, id: string | number, reason: Bust['reason'], lanes: Lanes): Bust[] => [
  ...(lanes === 'both' ? [{ tag: tags.doc(slug, id), reason }] : []),
  { tag: tags.doc(slug, id, { draft: true }), reason },
]

/** One list scope's tags (`scope: undefined` = the bare collection list tag), lane-aware. */
export const listTags = (slug: string, scope: string | undefined, lanes: Lanes): Bust[] => [
  ...(lanes === 'both' ? [{ tag: tags.list(slug, { scope }), reason: 'list' as const }] : []),
  { tag: tags.list(slug, { scope, draft: true }), reason: 'list' as const },
]

/** `extraTags`, lane-aware: published-surface writes bust the base tag (every carrying
 *  entry — draft reads included — has it); draft saves bust only the `:draft` variants. */
export const extraTagBusts = (extraTags: string[], lanes: Lanes): Bust[] =>
  extraTags.map((tag) => ({ tag: lanes === 'both' ? tag : `${tag}:draft`, reason: 'extra' as const }))

export interface RuleGate {
  changed: Set<string> | null
  /** Membership events fire `whenFields` rules unconditionally: the publish-time diff can't
   *  see edits that arrived through earlier draft saves (previousDoc IS the latest draft). */
  membership: boolean
  docs?: { doc: unknown; previousDoc: unknown }
}

export const ruleTags = (slug: string, rules: DependencyRule[], gate: RuleGate): Bust[] =>
  rules
    .filter((rule) => rule.on === slug && (!rule.whenFields || gate.membership || anyChanged(gate.changed, rule.whenFields, gate.docs)))
    .flatMap((rule) => rule.bust.map((tag) => ({ tag, reason: 'rule' as const })))

/** Bare list + every declared scope — the membership-event and delete blast radius. */
export const allListTags = (slug: string, settings: CollectionSettings, lanes: Lanes): Bust[] => [
  ...listTags(slug, undefined, lanes),
  ...Object.keys(settings.lists).flatMap((scope) => listTags(slug, scope, lanes)),
]

/** One parent's join-membership tags (`{child}:join:{on}:{parentId}`), lane-aware. */
export const joinTags = (child: string, on: string, parent: string | number, lanes: Lanes): Bust[] => [
  ...(lanes === 'both' ? [{ tag: tags.join(child, on, parent), reason: 'join' as const }] : []),
  { tag: tags.join(child, on, parent, { draft: true }), reason: 'join' as const },
]
