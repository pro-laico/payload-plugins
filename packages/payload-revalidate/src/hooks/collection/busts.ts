import { anyChanged } from '../../lib/changedFields'
import { isId } from '../../lib/values'
import { tags } from '../../tags'
import type { Bust, CollectionSettings, DependencyRule, Lanes, RuleGate } from '../../types'

/** Shared bust-builders for the collection write side — the leaf both {@link createAfterChange}
 *  and {@link createAfterDelete} import (never the reverse), keeping the graph acyclic. */

export const aliasOf = (doc: Record<string, unknown>, idField: string | false): string | number | undefined => {
  if (!idField) return undefined
  const value = doc[idField]
  return isId(value) ? value : undefined
}

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
