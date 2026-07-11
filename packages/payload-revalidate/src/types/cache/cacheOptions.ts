import type { WalkOptions } from './walk'

interface BaseOptions {
  /** This read is draft-scoped (key `draft` as a getter argument!) — draft-lane tag
   *  variants are added so draft saves purge it. @default false */
  draft?: boolean
  /** Extra static tags for this entry (e.g. `'sitemap'`). */
  tags?: string[]
  /** Name for this read in the dev map (defaults to its shape). */
  label?: string
}

export interface CacheDocOptions extends BaseOptions {
  /** The identifier the read is keyed by — an alias (slug) or id. Tagged even when the
   *  doc is `null`, so a cached miss purges the moment the doc is created. */
  as?: string | number
  /** Tune ({@link WalkOptions}) or disable (`false`) the bake-in walk. */
  walk?: false | WalkOptions
}

export interface CacheIdsOptions extends BaseOptions {
  /** The declared list scope this read renders (`lists.recent` in the plugin options) —
   *  the entry carries `{slug}:list:{scope}` so reorders bust it precisely. Omit for the
   *  bare collection list tag (membership events only). */
  list?: string
}

export interface FinishInput {
  kind: 'doc' | 'global'
  collection?: string
  global?: string
  as?: string | number
  staticTags: string[]
  value: unknown
  slug: string
  options: CacheDocOptions
}
