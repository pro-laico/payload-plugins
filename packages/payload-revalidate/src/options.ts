import type { CollectionConfig, GlobalConfig } from 'payload'

import { createOnce } from './lib/once'
import { isRecord } from './lib/isRecord'
import { findTopLevelField } from './lib/fields'
import type { CollectionRevalidateConfig, CollectionSettings, ResolvedRevalidateOptions, RevalidatePluginOptions } from './types'

export function resolveOptions(options: RevalidatePluginOptions = {}): ResolvedRevalidateOptions {
  return {
    enabled: options.enabled ?? true,
    prefix: options.prefix ?? '',
    collections: options.collections ?? {},
    globals: options.globals ?? {},
    rules: options.rules ?? [],
    observe: options.observe ?? process.env.NODE_ENV === 'development',
  }
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

const shapeWarnedOnce = createOnce()
const shapeWarn = (slug: string, key: string, expected: string): void => {
  if (shapeWarnedOnce(`${slug}:${key}`))
    console.warn(`[payload-revalidate] collection '${slug}': revalidate config '${key}' is malformed (expected ${expected}) — ignoring it.`)
}

export function resolveCollectionSettings(collection: CollectionConfig, resolved: ResolvedRevalidateOptions): CollectionSettings | null {
  const marker = collection.custom?.revalidate
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
    shapeWarn(collection.slug, 'lists', 'an object of { [scope]: string[] | { fields: string[] } }')
  } else {
    for (const [scope, config] of Object.entries(rawLists ?? {})) {
      if (isStringArray(config)) {
        lists[scope] = config
      } else if (isRecord(config) && isStringArray(config.fields)) {
        lists[scope] = config.fields
      } else {
        shapeWarn(collection.slug, `lists.${scope}`, 'string[] or { fields: string[] }')
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

export function globalEnabled(global: GlobalConfig, resolved: ResolvedRevalidateOptions): boolean {
  const marker = global.custom?.revalidate
  return resolved.globals[global.slug] !== false && marker !== false
}
