import type { Field, Where } from 'payload'

import { isId } from '../values'
import { isRecord } from '../isRecord'
import type { JoinMembership } from '../../types'

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

export const collectJoinMembership = (collections: { slug: string; fields: Field[] }[] | undefined): Record<string, JoinMembership[]> => {
  const index = new Map<string, Map<string, Set<string>>>()
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

export const extractOnValues = (data: unknown, on: string): (string | number)[] => {
  let current: unknown = data
  for (const key of on.split('.')) {
    if (Array.isArray(current)) break
    if (!isRecord(current)) {
      current = undefined
      break
    }
    current = current[key]
  }
  const out: (string | number)[] = []
  const push = (value: unknown): void => {
    if (value == null) return
    if (isId(value)) {
      out.push(value)
    } else if (isRecord(value)) {
      if ('relationTo' in value && 'value' in value) push(value.value)
      else if (isId(value.id)) out.push(value.id)
    }
  }
  for (const item of Array.isArray(current) ? current : [current]) push(item)
  return [...new Set(out)]
}
