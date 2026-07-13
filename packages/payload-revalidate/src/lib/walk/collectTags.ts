import type { Field } from 'payload'

import { isId, isPlainObject } from '../values'
import { createTags } from '../tags'
import type { BakedEmbed, IndexSource, SchemaIndex, Tags, WalkOptions, WalkResult } from '../../types'

/**
 * The runtime bake-in walk: given a value a getter just fetched and the field schema it
 * was fetched with, find every POPULATED embedded document — content that is baked into
 * this cache entry — and emit its doc tag with the field path it came through.
 *
 * Atomic model: raw-id references are deliberately NOT tagged. An id is stable — the
 * entry holding it never goes stale when the referenced doc's content changes; freshness
 * belongs to the id-keyed getter (`cacheDoc`) that actually renders the doc. Only baked
 * content couples two entries, so only baked content produces dependency tags — and every
 * bake-in is reported (`embeds[].via`) so the dev map can flag it as a refactor candidate.
 *
 * Covered: relationship/upload values (populated docs, polymorphic wrappers, hasMany),
 * joins, rows of arrays/blocks/groups/tabs, localized value maps, and upload/relationship
 * nodes inside Lexical richText. Populated docs are recursed with their own collection's
 * schema up to `maxDepth`.
 *
 * Pure and in-memory — no queries, no Payload boot; unit-testable with fixture schemas.
 */

/** Index a (sanitized or raw) config's collections, globals, config-level blocks registry, and locale codes. */
export const indexSchema = (config: IndexSource): SchemaIndex => {
  const collections = new Map((config.collections ?? []).map((c) => [c.slug, c]))
  const globals = new Map((config.globals ?? []).map((g) => [g.slug, g]))
  const blocks = new Map((config.blocks ?? []).map((b) => [b.slug, b]))
  const locales = config.localization ? (config.localization.locales ?? []).map((l) => (typeof l === 'string' ? l : l.code)) : []
  return { collection: (slug) => collections.get(slug), global: (slug) => globals.get(slug), block: (slug) => blocks.get(slug), locales }
}

/**
 * Collect the baked-in embeds of `value` (one doc, or an array of docs) using `fields`
 * as its schema. Emits base (published-lane) tags — the caller adds `:draft` variants
 * when the read is draft-scoped. Does NOT emit the top-level doc's own tag; that's the
 * caller's job.
 */
export function collectDepTags(
  value: unknown,
  fields: Field[],
  schema: SchemaIndex,
  opts: WalkOptions = {},
  tags: Tags = createTags(),
): WalkResult {
  const maxDepth = opts.maxDepth ?? 6
  const maxTags = opts.maxTags ?? 64
  const seen = new Set<string>()
  const embeds: BakedEmbed[] = []
  const visited = new Set<string>()
  let capped = false

  const emit = (slug: string, id: string | number, via: string, kind: BakedEmbed['kind']): void => {
    if (seen.size >= maxTags) {
      capped = true
      return
    }
    const tag = tags.doc(slug, id)
    seen.add(tag)
    embeds.push({ tag, via, kind })
  }

  /** A join's MEMBERSHIP tag, keyed by the owning doc's id: the parent entry must carry it
   *  so a child joining/leaving (create/delete/reassign) re-materializes the join. Unlike
   *  the populated members (which are ids under the atomic rule and never tagged), the join
   *  list itself has no stable id to key on, so this dependency is emitted even when nothing
   *  is baked in. Skipped when the owner has no id (can't key membership).
   *
   *  NOT recorded as an embed: a membership dependency is intrinsic to reading a join, not
   *  baked-in content — it must never show up on the dev map's "fetch shallow" refactor
   *  list. It rides in `tags` (applied + shown as a dep tag) only. */
  const emitJoin = (child: string | string[], on: string, ownerId: string | number): void => {
    for (const coll of Array.isArray(child) ? child : [child]) {
      if (seen.size >= maxTags) {
        capped = true
        return
      }
      seen.add(tags.join(coll, on, ownerId))
    }
  }

  /** A relationship-shaped value: raw id (SKIPPED — atomic), populated doc, or polymorphic wrapper. */
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

  /** Recurse into a populated doc with its own collection's schema. */
  const visitDoc = (doc: Record<string, unknown>, slug: string, via: string, depth: number): void => {
    if (capped || depth >= maxDepth) return
    const key = `${slug}:${String(doc.id)}`
    if (visited.has(key)) return
    visited.add(key)
    const config = schema.collection(slug)
    if (config) visitFields(doc, config.fields, via, depth + 1, isId(doc.id) ? doc.id : undefined)
  }

  /** Any upload/relationship/link node in a Lexical tree carries `{ relationTo, value }`.
   *  Block nodes are different: their `fields` hold ORDINARY Payload field data (a
   *  populated single-relationship there is a bare doc, no wrapper), so they're walked
   *  with the block's schema when the config-level registry knows it — falling back to
   *  the generic scan (which still catches wrapped nodes) when it doesn't. */
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
        // Joins don't live inside richText blocks, so there's no membership to key here.
        visitFields(node.fields, block.fields, `${via}.${node.fields.blockType}`, depth, undefined)
        return
      }
    }
    for (const child of Object.values(node)) scanRichText(child, via, depth)
  }

  const localeCodes = new Set(schema.locales ?? [])

  /** Whether a plain object is a `locale: 'all'` map (every key a known locale code). Needs
   *  the config's locale list — a GROUP/tab's real content (`{ heading, body }`) is otherwise
   *  shape-identical to a locale map (`{ en, de }`), so without codes we must NOT fan out. */
  const isLocaleMap = (value: Record<string, unknown>): boolean => {
    const keys = Object.keys(value)
    return localeCodes.size > 0 && keys.length > 0 && keys.every((key) => localeCodes.has(key))
  }

  /** A localized field fetched with `locale: 'all'` wraps its value in a per-locale map. */
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
    // A group's single-locale value is an arbitrary object, so fan out ONLY on a confirmed
    // locale map — otherwise `{ heading, body }` would be misread as two "locales".
    if (field.type === 'group' && isLocaleMap(value)) return Object.values(value)
    return [value]
  }

  /** Fan a named tab's value across locales when the tab is localized and fetched with
   *  `locale: 'all'` (same object-vs-locale-map ambiguity as a group). */
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
          // Named groups nest data; unnamed groups are presentational wrappers.
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
                // The membership dependency (needed even when members are ids), then any
                // populated members baked in (the anti-pattern the walk still tags).
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

  for (const doc of Array.isArray(value) ? value : [value]) {
    if (isPlainObject(doc)) visitFields(doc, fields, '', 0, isId(doc.id) ? doc.id : undefined)
  }

  return { tags: [...seen], embeds, capped }
}
