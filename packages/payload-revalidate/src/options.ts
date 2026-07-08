import type { CollectionConfig, GlobalConfig } from 'payload'

import { findTopLevelField } from './lib/fields'
import { createOnce } from './lib/once'
import type { CollectionRevalidateConfig, DependencyRule, RevalidateMarker } from './types'

/**
 * Options for {@link revalidatePlugin}. Zero-config by design: `revalidatePlugin()`
 * attaches surgical revalidation hooks to every collection and global, and the `./cache`
 * helpers pick everything up from the config. Reach for options only to opt slugs out,
 * tune list-tag sensitivity, or add manual dependency rules.
 *
 * @example
 * ```ts
 * revalidatePlugin({
 *   collections: { searchIndex: false, posts: { listFields: ['featured'] } },
 *   rules: [{ on: 'faqs', bust: ['services'], whenFields: ['question', 'answer'] }],
 * })
 * ```
 */
export interface RevalidatePluginOptions {
  /** When `false`, the plugin is a no-op — no hooks, no endpoint. @default true */
  enabled?: boolean
  /** Namespace prefixed onto every tag (`shop` → `shop:posts:42`). Use when multiple
   *  Payload apps share one Next cache surface. @default '' */
  prefix?: string
  /** Per-collection settings or `false` to opt a collection out. Wins over the
   *  collection's own `custom.revalidate` marker, field by field. */
  collections?: Partial<Record<string, CollectionRevalidateConfig | false>>
  /** Set a global's slug to `false` to opt it out of the auto-attached hook. */
  globals?: Partial<Record<string, false>>
  /** Manual dependency rules for flows the automation can't see. See {@link DependencyRule}. */
  rules?: DependencyRule[]
  /** Record cached reads + revalidation events for the dependency map (`/api/revalidate-map`
   *  and the dev-tools view). @default `NODE_ENV === 'development'` */
  observe?: boolean
  /** Register the `GET`/`POST /api/revalidate-map` endpoint (it 404s outside dev unless
   *  `observe` is forced on). @default true */
  endpoint?: boolean
}

/** Options with defaults applied (internal). */
export interface ResolvedRevalidateOptions {
  enabled: boolean
  prefix: string
  collections: Partial<Record<string, CollectionRevalidateConfig | false>>
  globals: Partial<Record<string, false>>
  rules: DependencyRule[]
  observe: boolean
  endpoint: boolean
}

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

/** A collection's effective settings once the marker and plugin options are merged. */
export interface CollectionSettings {
  idField: string | false
  /** Declared list scopes, normalized to scope → determinant fields. */
  lists: Record<string, string[]>
  extraTags: string[]
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
