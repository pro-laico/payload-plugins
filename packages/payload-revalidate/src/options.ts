import type { CollectionConfig, GlobalConfig } from 'payload'

import { findTopLevelField } from './lib/fields'
import { createOnce } from './lib/once'
import type {
  CollectionRevalidateConfig,
  CollectionSettings,
  ResolvedRevalidateOptions,
  RevalidateMarker,
  RevalidatePluginOptions,
} from './types'

export function resolveOptions(options: RevalidatePluginOptions = {}): ResolvedRevalidateOptions {
  return {
    enabled: options.enabled ?? true,
    prefix: options.prefix ?? '',
    collections: options.collections ?? {},
    globals: options.globals ?? {},
    rules: options.rules ?? [],
    observe: options.observe ?? process.env.NODE_ENV === 'development',
    endpoint: options.endpoint ?? true,
  }
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

/** Config-build-time shape check warned once per slug+key: `custom.revalidate` markers are
 *  authored by third-party packages WITHOUT types, and a malformed entry must degrade to
 *  "ignored with a warning" — not throw from the afterChange hook on every save. */
const shapeWarnedOnce = createOnce()
const shapeWarn = (slug: string, key: string, expected: string): void => {
  if (shapeWarnedOnce(`${slug}:${key}`))
    console.warn(`[payload-revalidate] collection '${slug}': revalidate config '${key}' is malformed (expected ${expected}) — ignoring it.`)
}

/**
 * Merge a collection's `custom.revalidate` marker with the plugin's per-slug options
 * (options win, field by field) and apply defaults. Returns `null` when the collection is
 * opted out — either side saying `false` opts out, but an options object overrides a
 * marker `false` (options always win). Malformed pieces are dropped with a warning, never
 * allowed through to the hooks.
 */
export function resolveCollectionSettings(collection: CollectionConfig, resolved: ResolvedRevalidateOptions): CollectionSettings | null {
  const marker = (collection.custom as { revalidate?: RevalidateMarker } | undefined)?.revalidate
  const override = resolved.collections[collection.slug]
  if (override === false) return null
  if (marker === false && override === undefined) return null

  const merged: CollectionRevalidateConfig = { ...(marker === false || typeof marker !== 'object' ? undefined : marker), ...override }

  let idField = merged.idField !== undefined ? merged.idField : findTopLevelField(collection.fields, 'slug') ? 'slug' : false
  if (idField !== false && typeof idField !== 'string') {
    shapeWarn(collection.slug, 'idField', 'a field name string or false')
    idField = findTopLevelField(collection.fields, 'slug') ? 'slug' : false
  }

  const lists: Record<string, string[]> = {}
  const rawLists = merged.lists
  if (rawLists !== undefined && (typeof rawLists !== 'object' || rawLists === null || Array.isArray(rawLists))) {
    shapeWarn(collection.slug, 'lists', 'an object of { [scope]: { fields: string[] } }')
  } else {
    for (const [scope, config] of Object.entries(rawLists ?? {})) {
      if (typeof config === 'object' && config !== null && isStringArray((config as { fields?: unknown }).fields)) {
        lists[scope] = (config as { fields: string[] }).fields
      } else {
        shapeWarn(collection.slug, `lists.${scope}`, '{ fields: string[] }')
      }
    }
  }

  let extraTags = merged.extraTags ?? []
  if (!isStringArray(extraTags)) {
    shapeWarn(collection.slug, 'extraTags', 'string[]')
    extraTags = []
  }

  return { idField, lists, extraTags }
}

/** Whether a global gets the auto-attached hook (its marker or the plugin's `globals` map can opt it out). */
export function globalEnabled(global: GlobalConfig, resolved: ResolvedRevalidateOptions): boolean {
  const marker = (global.custom as { revalidate?: RevalidateMarker } | undefined)?.revalidate
  return resolved.globals[global.slug] !== false && marker !== false
}
