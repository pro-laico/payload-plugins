/**
 * The canonical tag vocabulary — the single source of truth shared by the read side
 * (`cacheDoc`/`cacheList`/`cacheGlobal` in `./cache`), the write side (the auto-attached
 * hooks), and any hand-written `revalidateTag` call. Tags are id-based (database ids are
 * stable across renames and present on every relationship value, populated or not), plus
 * an optional alias tag derived from a collection's `idField` (default: its `slug` field)
 * so slug-keyed reads can tag before the id is known.
 *
 * | Tag | Meaning |
 * | --- | --- |
 * | `{slug}` / `{slug}:draft` | a collection's list surfaces, per lane |
 * | `{slug}:{id}` / `…:draft` | one doc (db id or alias) + every cache entry embedding it |
 * | `{child}:join:{on}:{parentId}` | one parent's join membership (`all my <child>`), per lane |
 * | `global:{slug}` / `…:draft` | a global |
 * | `all` | on every entry `./cache` tags; `revalidateAll()` busts this one tag |
 *
 * All builders honor the plugin's `prefix` option (namespace for multi-app caches). The
 * builders are PURE — `createTags(prefix)` binds a prefix once; the plugin factory builds
 * one set for the hooks, and the `./cache` helpers build theirs from the config marker on
 * the handle the app passed in. No global state.
 */

import type { TagLaneOptions, TagListOptions, Tags } from '../types'

const lane = (tag: string, draft?: boolean): string => (draft ? `${tag}:draft` : tag)

/**
 * The tag builders, bound to one namespace prefix. Everything the plugin busts or applies
 * is constructed here — never hand-spell a tag string.
 *
 * @example
 * ```ts
 * const tags = createTags('shop')
 * tags.list('posts')                    // 'shop:posts'
 * tags.doc('posts', 42)                 // 'shop:posts:42'
 * tags.doc('posts', 'my-slug', { draft: true }) // 'shop:posts:my-slug:draft'
 * tags.global('header')                 // 'shop:global:header'
 * tags.all()                            // 'shop:all'
 * ```
 */
export const createTags = (prefix = ''): Tags => {
  const p = prefix ? `${prefix}:` : ''
  return {
    /** A collection's list tag — carried by id-list reads (`cacheIds`). Bare form busts on
     *  membership events (create/delete/publish/unpublish); a `scope` variant additionally
     *  busts when the scope's declared fields change. */
    list: (slug: string, o?: TagListOptions): string => lane(`${p}${slug}${o?.scope ? `:list:${o.scope}` : ''}`, o?.draft),
    /** One doc's tag, by database id or by alias (`idField` value). Also the dependency tag other entries carry when they embed the doc. */
    doc: (slug: string, id: string | number, o?: TagLaneOptions): string => lane(`${p}${slug}:${id}`, o?.draft),
    /** One parent's join membership: the set of `child` docs whose `on` field points at
     *  `parentId` (`category` renders "all my posts"). Carried by a parent entry that reads a
     *  join; busted when a child joins/leaves that parent (create/delete/reassign) or a
     *  `where`-determinant flips it in/out. Keyed by (child, on, parentId) — host-agnostic, so
     *  two collections joining the same child on the same field share one tag. */
    join: (child: string, on: string, parentId: string | number, o?: TagLaneOptions): string =>
      lane(`${p}${child}:join:${on}:${parentId}`, o?.draft),
    /** A global's tag. Namespaced under `global:` so it can't collide with a collection's list tag. */
    global: (slug: string, o?: TagLaneOptions): string => lane(`${p}global:${slug}`, o?.draft),
    /** The whole-surface tag every `./cache` read carries — `revalidateAll()` busts just this. */
    all: (): string => `${p}all`,
  }
}

/**
 * Why an alias (`idField`) VALUE is a tag-collision hazard, or `null` when it's safe. Alias
 * tags share the `{slug}:{value}` shape with id tags, list lanes, scoped lists, and joins,
 * so a few slug values coincide with those structural tags. Every such collision is
 * OVER-BUST only (two things share a tag → both bust together) and NEVER causes staleness —
 * but it's surprising, so the `./cache` helpers dev-warn once. Numbers are exempt (a numeric
 * id used as its own alias is skipped upstream). Pure detector for {@link cacheDoc}/tests.
 */
export const riskyAliasReason = (value: string | number): string | null => {
  if (typeof value === 'number') return null
  if (value === 'draft') return "equals the reserved 'draft' lane suffix — collides with the list tag {slug}:draft"
  if (value.includes(':')) return "contains ':' — collides with scoped-list / join / draft tag structure"
  if (/^\d+$/.test(value)) return 'is all digits — collides with a document’s numeric database-id tag'
  return null
}
