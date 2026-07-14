import type { TagLaneOptions, TagListOptions, Tags } from '../types'

const lane = (tag: string, draft?: boolean): string => (draft ? `${tag}:draft` : tag)

export const createTags = (prefix = ''): Tags => {
  const p = prefix ? `${prefix}:` : ''
  return {
    list: (slug: string, o?: TagListOptions): string => lane(`${p}${slug}${o?.scope ? `:list:${o.scope}` : ''}`, o?.draft),
    doc: (slug: string, id: string | number, o?: TagLaneOptions): string => lane(`${p}${slug}:${id}`, o?.draft),
    join: (child: string, on: string, parentId: string | number, o?: TagLaneOptions): string =>
      lane(`${p}${child}:join:${on}:${parentId}`, o?.draft),
    global: (slug: string, o?: TagLaneOptions): string => lane(`${p}global:${slug}`, o?.draft),
    all: (): string => `${p}all`,
  }
}

export const riskyAliasReason = (value: string | number): string | null => {
  if (typeof value === 'number') return null
  if (value === 'draft') return "equals the reserved 'draft' lane suffix — collides with the list tag {slug}:draft"
  if (value.includes(':')) return "contains ':' — collides with scoped-list / join / draft tag structure"
  if (/^\d+$/.test(value)) return 'is all digits — collides with a document’s numeric database-id tag'
  return null
}
