import type { Field } from 'payload'

import { createTags } from '../tags'
import { isId, isPlainObject } from '../values'
import type { BakedEmbed, IndexSource, SchemaIndex, Tags, WalkOptions, WalkResult } from '../../types'

export const indexSchema = (config: IndexSource): SchemaIndex => {
  const blocks = new Map((config.blocks ?? []).map((b) => [b.slug, b]))
  const globals = new Map((config.globals ?? []).map((g) => [g.slug, g]))
  const collections = new Map((config.collections ?? []).map((c) => [c.slug, c]))
  const locales = config.localization ? (config.localization.locales ?? []).map((l) => (typeof l === 'string' ? l : l.code)) : []
  return { collection: (slug) => collections.get(slug), global: (slug) => globals.get(slug), block: (slug) => blocks.get(slug), locales }
}

export function collectDepTags(
  value: unknown,
  fields: Field[],
  schema: SchemaIndex,
  opts: WalkOptions = {},
  tags: Tags = createTags(),
): WalkResult {
  let capped = false
  const seen = new Set<string>()
  const embeds: BakedEmbed[] = []
  const visited = new Set<string>()
  const maxTags = opts.maxTags ?? 64
  const maxDepth = opts.maxDepth ?? 6

  const emit = (slug: string, id: string | number, via: string, kind: BakedEmbed['kind']): void => {
    if (seen.size >= maxTags) {
      capped = true
      return
    }
    const tag = tags.doc(slug, id)
    seen.add(tag)
    embeds.push({ tag, via, kind })
  }

  const emitJoin = (child: string | string[], on: string, ownerId: string | number): void => {
    for (const coll of Array.isArray(child) ? child : [child]) {
      if (seen.size >= maxTags) {
        capped = true
        return
      }
      seen.add(tags.join(coll, on, ownerId))
    }
  }

  const visitRelValue = (
    item: unknown,
    relationTo: string | string[] | undefined,
    via: string,
    kind: BakedEmbed['kind'],
    depth: number,
  ): void => {
    if (capped || item == null || isId(item)) return
    if (!isPlainObject(item)) return
    if ('relationTo' in item && 'value' in item && typeof item.relationTo === 'string') {
      visitRelValue(item.value, item.relationTo, via, kind, depth)
      return
    }
    if (isId(item.id) && typeof relationTo === 'string') {
      emit(relationTo, item.id, via, kind)
      visitDoc(item, relationTo, via, depth)
    }
  }

  const visitDoc = (doc: Record<string, unknown>, slug: string, via: string, depth: number): void => {
    if (capped || depth >= maxDepth) return
    const key = `${slug}:${String(doc.id)}`
    if (visited.has(key)) return
    visited.add(key)
    const config = schema.collection(slug)
    if (config) visitFields(doc, config.fields, via, depth + 1, isId(doc.id) ? doc.id : undefined)
  }

  const scanRichText = (node: unknown, via: string, depth: number): void => {
    if (capped || node == null) return
    if (Array.isArray(node)) {
      for (const item of node) scanRichText(item, via, depth)
      return
    }
    if (!isPlainObject(node)) return
    if ('relationTo' in node && 'value' in node && typeof node.relationTo === 'string') {
      visitRelValue(node, undefined, via, 'richText', depth)
      return
    }
    if ((node.type === 'block' || node.type === 'inlineBlock') && isPlainObject(node.fields) && typeof node.fields.blockType === 'string') {
      const block = schema.block(node.fields.blockType)
      if (block) {
        visitFields(node.fields, block.fields, `${via}.${node.fields.blockType}`, depth, undefined)
        return
      }
    }
    for (const child of Object.values(node)) scanRichText(child, via, depth)
  }

  const localeCodes = new Set(schema.locales ?? [])

  const isLocaleMap = (value: Record<string, unknown>): boolean => {
    const keys = Object.keys(value)
    return localeCodes.size > 0 && keys.length > 0 && keys.every((key) => localeCodes.has(key))
  }

  const unwrapLocales = (field: Field, value: unknown): unknown[] => {
    if (!('localized' in field) || !field.localized || !isPlainObject(value)) return [value]
    if ('relationTo' in value || 'id' in value || 'root' in value) return [value]
    if (
      field.type === 'array' ||
      field.type === 'blocks' ||
      field.type === 'richText' ||
      field.type === 'relationship' ||
      field.type === 'upload'
    )
      return Object.values(value)
    if (field.type === 'group' && isLocaleMap(value)) return Object.values(value)
    return [value]
  }

  const unwrapTab = (localized: boolean | undefined, value: unknown): unknown[] =>
    localized && isPlainObject(value) && isLocaleMap(value) ? Object.values(value) : [value]

  const visitFields = (data: unknown, fields: Field[], parent: string, depth: number, ownerId: string | number | undefined): void => {
    if (capped || !isPlainObject(data)) return
    for (const field of fields) {
      if (capped) return
      const path = 'name' in field && field.name ? (parent ? `${parent}.${field.name}` : field.name) : parent
      switch (field.type) {
        case 'row':
        case 'collapsible':
          visitFields(data, field.fields, parent, depth, ownerId)
          break
        case 'tabs':
          for (const tab of field.tabs) {
            if ('name' in tab && tab.name)
              for (const value of unwrapTab('localized' in tab ? tab.localized : undefined, data[tab.name]))
                visitFields(value, tab.fields, parent ? `${parent}.${tab.name}` : tab.name, depth, ownerId)
            else visitFields(data, tab.fields, parent, depth, ownerId)
          }
          break
        case 'group':
          if ('name' in field && field.name)
            for (const value of unwrapLocales(field, data[field.name])) visitFields(value, field.fields, path, depth, ownerId)
          else visitFields(data, field.fields, parent, depth, ownerId)
          break
        default: {
          if (!('name' in field) || !field.name) break
          for (const value of unwrapLocales(field, data[field.name])) {
            switch (field.type) {
              case 'relationship':
              case 'upload':
                for (const item of Array.isArray(value) ? value : [value])
                  visitRelValue(item, field.relationTo, path, field.type === 'upload' ? 'upload' : 'relationship', depth)
                break
              case 'join': {
                if (ownerId !== undefined) emitJoin(field.collection, field.on, ownerId)
                const docs = isPlainObject(value) && Array.isArray(value.docs) ? value.docs : []
                for (const item of docs) visitRelValue(item, field.collection, path, 'join', depth)
                break
              }
              case 'richText':
                scanRichText(value, path, depth)
                break
              case 'array':
                for (const row of Array.isArray(value) ? value : []) visitFields(row, field.fields, path, depth, ownerId)
                break
              case 'blocks': {
                for (const row of Array.isArray(value) ? value : []) {
                  if (!isPlainObject(row) || typeof row.blockType !== 'string') continue
                  const inline = (field.blocks ?? []).find((b) => b.slug === row.blockType)
                  const referenced = (field.blockReferences ?? [])
                    .map((ref) => (typeof ref === 'string' ? schema.block(ref) : ref))
                    .find((b) => b != null && b.slug === row.blockType)
                  const block = inline ?? referenced
                  if (block) visitFields(row, block.fields, `${path}.${row.blockType}`, depth, ownerId)
                }
                break
              }
              default:
                break
            }
          }
          break
        }
      }
    }
  }

  for (const doc of Array.isArray(value) ? value : [value])
    if (isPlainObject(doc)) visitFields(doc, fields, '', 0, isId(doc.id) ? doc.id : undefined)

  return { tags: [...seen], embeds, capped }
}
