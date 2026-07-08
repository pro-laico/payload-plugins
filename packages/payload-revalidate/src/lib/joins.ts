import type { Field, Where } from 'payload'

import { isId } from './values'

/**
 * Join membership: the write-side companion to the read side's `{child}:join:{on}:{parentId}`
 * tag. A `join` field on a PARENT collection (`category` renders "all my posts") is a live
 * query, not a stored reference — so its membership moves when a CHILD (`posts`) is
 * created, deleted, or reassigned, with none of the current members changing. The atomic
 * "ids are stable, skip them" rule doesn't hold for a join: the list *is* the content, and
 * there is no stable id to key freshness on.
 *
 * This module indexes joins by the CHILD collection (the joined side, `field.collection`) —
 * the collection whose writes move a parent's membership — so the per-collection write hook
 * can answer "which parent joins does a `posts` write touch?" and bust exactly the affected
 * parents' tags. Surgical: a post created in category A busts A's join entry, not B's.
 */
export interface JoinMembership {
  /** The relationship field on the child collection whose value names the parent doc. */
  on: string
  /** Child fields referenced by the join's `where` filter. A change to one flips the child
   *  in/out of the filtered membership, so it busts the parent's join tag even without a
   *  reassignment. (Order-only `sort` determinants are intentionally not tracked.) */
  determinants: string[]
}

/** The field paths a Payload `where` filters on — its query keys, minus the `and`/`or`
 *  combinators (whose values are nested clause arrays, recursed into). */
export const whereFields = (where: Where | undefined): string[] => {
  const out = new Set<string>()
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return
    for (const [key, value] of Object.entries(node)) {
      if (key === 'and' || key === 'or') {
        if (Array.isArray(value)) for (const clause of value) walk(clause)
      } else {
        out.add(key)
      }
    }
  }
  walk(where)
  return [...out]
}

/**
 * Scan every collection's fields for `join` fields and index them by child collection.
 * Multiple parents joining the same child on the same field collapse to one rule (their
 * `where` determinants unioned) — the membership tag is keyed by (child, on, parentId), so
 * it's host-agnostic and a single tag serves every parent that reads the join. Descends the
 * same containers as the reference graph; joins can't live in a document's leaf value, so
 * only structural nesting is walked.
 */
export const collectJoinMembership = (collections: { slug: string; fields: Field[] }[] | undefined): Record<string, JoinMembership[]> => {
  const index = new Map<string, Map<string, Set<string>>>() // child -> on -> determinant fields
  const add = (child: string, on: string, determinants: string[]): void => {
    let byOn = index.get(child)
    if (!byOn) {
      byOn = new Map()
      index.set(child, byOn)
    }
    let set = byOn.get(on)
    if (!set) {
      set = new Set()
      byOn.set(on, set)
    }
    for (const field of determinants) set.add(field)
  }
  const walk = (fields: Field[] | undefined): void => {
    for (const field of fields ?? []) {
      switch (field.type) {
        case 'join': {
          const determinants = whereFields(field.where)
          for (const child of Array.isArray(field.collection) ? field.collection : [field.collection]) add(child, field.on, determinants)
          break
        }
        case 'array':
        case 'group':
        case 'row':
        case 'collapsible':
          walk(field.fields)
          break
        case 'tabs':
          for (const tab of field.tabs) walk(tab.fields)
          break
        case 'blocks':
          for (const block of field.blocks ?? []) walk(block.fields)
          break
        default:
          break
      }
    }
  }
  for (const collection of collections ?? []) walk(collection.fields)
  return Object.fromEntries([...index].map(([child, byOn]) => [child, [...byOn].map(([on, set]) => ({ on, determinants: [...set] }))]))
}

/**
 * The parent id(s) a child doc's `on` field points at — the parents whose join membership
 * this child belongs to. Absorbs every shape the value arrives in: raw id (depth-0
 * `previousDoc`), populated doc (`{ id }`, request-depth `doc`), polymorphic wrapper
 * (`{ relationTo, value }`), and `hasMany` arrays of any of those. Dotted `on` paths (a
 * relationship nested in a group) are resolved, stopping at the first array.
 */
export const extractOnValues = (data: unknown, on: string): (string | number)[] => {
  let current: unknown = data
  for (const key of on.split('.')) {
    if (Array.isArray(current)) break
    if (typeof current !== 'object' || current === null) {
      current = undefined
      break
    }
    current = (current as Record<string, unknown>)[key]
  }
  const out: (string | number)[] = []
  const push = (value: unknown): void => {
    if (value == null) return
    if (isId(value)) {
      out.push(value)
    } else if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      if ('relationTo' in record && 'value' in record) push(record.value)
      else if (isId(record.id)) out.push(record.id)
    }
  }
  for (const item of Array.isArray(current) ? current : [current]) push(item)
  return [...new Set(out)]
}
