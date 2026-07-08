import 'server-only'

import { bust } from '../lib/bust'
import { getConfig, getPayloadClient } from '../lib/getPayloadClient'
import { createOnce } from '../lib/once'
import { isId } from '../lib/values'
import { recordRead } from '../observe/registry'
import { getState, riskyAliasReason, tags } from '../tags'
import { type BakedEmbed, collectDepTags, indexSchema, type SchemaIndex, type WalkOptions } from '../walk/collectTags'

/**
 * The read side — atomic by design. Two rules shape every getter:
 *
 * 1. **Fetch shallow, reference by id.** A doc's entry holds ITS content; anything it
 *    references stays an id, rendered by a component that self-fetches through an
 *    id-keyed `cacheDoc` getter. Freshness then lives per doc: editing an image busts
 *    `media:{id}` and ONLY the image's own entry re-materializes — every host entry
 *    (holding just the id) survives, and Next recomposes on the next request.
 * 2. **Lists are id-lists.** `cacheIds` tags membership/order only; each item is its own
 *    `cacheDoc` entry. A title edit re-renders one card, not the archive.
 *
 * Populated content that DOES get baked in (depth > 0) is still tagged for correctness —
 * and reported as a refactor candidate in dev (console + the /dev/revalidate map).
 *
 * @example
 * ```ts
 * import { cacheDoc, cacheIds, getPayloadClient } from '@pro-laico/payload-revalidate/cache'
 *
 * export async function getPostIds(page = 1) {
 *   'use cache'
 *   const payload = await getPayloadClient()
 *   const res = await payload.find({ collection: 'posts', page, limit: 12, sort: '-publishedAt', select: {}, depth: 0 })
 *   return cacheIds(res, 'posts', { list: 'recent' })
 * }
 *
 * export async function getPost(id: string | number) {
 *   'use cache'
 *   const payload = await getPayloadClient()
 *   return cacheDoc(await payload.findByID({ collection: 'posts', id, depth: 0, disableErrors: true }), 'posts')
 * }
 * ```
 */
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

const docId = (doc: unknown): string | number | undefined =>
  typeof doc === 'object' && doc !== null && isId((doc as { id?: unknown }).id) ? (doc as { id: string | number }).id : undefined

const dev = (): boolean => process.env.NODE_ENV === 'development'

/** Warned-once registry so each read shape logs each advisory once per process (dev only). */
const warnedOnce = createOnce()
const warnOnce = (key: string, message: string): void => {
  if (dev() && warnedOnce(key)) console.warn(`[payload-revalidate] ${message}`)
}

/** Failure paths alert once per key in EVERY environment: each of these means entries are
 *  materializing under-tagged (silently unbustable) — that must be visible in prod logs,
 *  where until now the plugin degraded with zero signal. */
const alertedOnce = createOnce()
const alertOnce = (key: string, message: string, cause?: unknown): void => {
  if (alertedOnce(key)) console.error(`[payload-revalidate] ${message}`, cause instanceof Error ? cause.message : (cause ?? ''))
}

/** Next allows at most 128 tags per cache entry — tags past the limit are dropped. */
const NEXT_MAX_TAGS = 128

/** Apply Next's cacheTag without exploding outside a `'use cache'` scope. */
const applyCacheTags = async (allTags: string[]): Promise<void> => {
  if (allTags.length === 0) return
  try {
    const { cacheTag } = (await import('next/cache')) as unknown as { cacheTag: (...tags: string[]) => void }
    cacheTag(...allTags)
  } catch (err) {
    alertOnce(
      'cacheTag-failed',
      "cacheTag failed — this entry (and likely every entry) is materializing UNTAGGED and can never be revalidated. Are the cache helpers running inside a 'use cache' function, with cacheComponents enabled?",
      err,
    )
  }
}

/** Resolve the app's config BEFORE any tag string is built: resolving it runs the plugin
 *  factory, which stashes the tag prefix and declared scopes — otherwise a helper that is
 *  the first plugin code in a cold process would build unprefixed (unbustable) tags. */
const ensureStash = async (): Promise<void> => {
  try {
    await getConfig()
  } catch {
    // Unresolvable config is reported by schemaIndex (cacheDoc/cacheGlobal) below.
  }
}

/** Resolve the booted schema index; `null` (alerted) when the config isn't reachable — static tags still apply. */
const schemaIndex = async (): Promise<SchemaIndex | null> => {
  try {
    const config = await getConfig()
    return indexSchema(config as unknown as Parameters<typeof indexSchema>[0])
  } catch (err) {
    alertOnce(
      'schema-index-failed',
      'bake-in walk skipped — the Payload config is unreachable in this process, so populated content is baked in WITHOUT dependency tags (edits to embedded docs will not refresh these entries). Ensure Payload boots before reads, or add this package to transpilePackages.',
      err,
    )
    return null
  }
}

const withDraftVariants = (base: string[], draft: boolean | undefined): string[] => {
  if (!draft) return base
  const all = tags.all()
  return [...base, ...base.filter((tag) => tag !== all).map((tag) => `${tag}:draft`)]
}

interface FinishInput {
  kind: 'doc' | 'global'
  collection?: string
  global?: string
  as?: string | number
  staticTags: string[]
  value: unknown
  slug: string
  options: CacheDocOptions
}

/** Shared tail for doc/global reads: walk for bake-ins, advise, record, cacheTag. */
const finish = async ({ kind, collection, global, as, staticTags, value, slug, options }: FinishInput): Promise<void> => {
  const index = options.walk === false || value == null ? null : await schemaIndex()
  const entity = index ? (kind === 'global' ? index.global(slug) : index.collection(slug)) : undefined
  const walked =
    index && entity
      ? collectDepTags(value, entity.fields, index, options.walk === false ? undefined : options.walk)
      : { tags: [], embeds: [] as BakedEmbed[], capped: false }

  const name = options.label ?? `${kind}:${slug}${as !== undefined ? `:${as}` : ''}`
  if (walked.capped)
    warnOnce(`cap:${name}`, `${name}: bake-in walk hit maxTags — this entry may under-tag (raise walk.maxTags or narrow the read).`)
  if (walked.embeds.length)
    warnOnce(
      `baked:${name}`,
      `${name} bakes in ${walked.embeds.length} populated doc(s): ${walked.embeds.map((e) => `${e.via} → ${e.tag}`).join(', ')} — fetch shallow (depth: 0) and render references through id-keyed cacheDoc getters for surgical busts.`,
    )

  const statics = withDraftVariants([...staticTags, ...(options.tags ?? [])], options.draft)
  const deps = withDraftVariants(walked.tags, options.draft)

  // Enforce Next's per-entry tag limit OURSELVES, statics first: past 128 Next silently
  // drops the tail, and draft reads double the dep tags — so a walk under `maxTags` can
  // still overflow. Deterministic retention (statics, then deps in walk order) plus a
  // loud flag beats Next's silent truncation.
  const ordered = [...new Set([...statics, ...deps])]
  const trimmed = ordered.length > NEXT_MAX_TAGS
  const applied = trimmed ? ordered.slice(0, NEXT_MAX_TAGS) : ordered
  if (trimmed)
    alertOnce(
      `overflow:${name}`,
      `${name} computed ${ordered.length} tags — Next's limit is ${NEXT_MAX_TAGS}/entry; ${ordered.length - NEXT_MAX_TAGS} dependency tag(s) were dropped and those embedded docs will NOT refresh this entry. Fetch shallower (depth: 0) or lower walk.maxTags${options.draft ? ' (draft reads double every dep tag)' : ''}.`,
    )

  recordRead({
    kind,
    collection,
    global,
    as,
    draft: options.draft ?? false,
    label: options.label,
    staticTags: statics,
    depTags: deps,
    bakedIn: walked.embeds,
    capped: walked.capped || trimmed,
  })
  await applyCacheTags(applied)
}

/**
 * Tag a doc-scoped read — THE atomic unit. Tags: `all`, `{slug}:{id}` (when the doc
 * resolved), `{slug}:{as}` (the alias/identifier it was keyed by — also on `null` misses),
 * any baked-in doc's tag (dev-flagged), and `:draft` variants when `draft`. A `null` doc
 * with no `as` falls back to the bare list tag so the miss still purges on the next create.
 */
export async function cacheDoc<T>(doc: T, collection: string, options: CacheDocOptions = {}): Promise<T> {
  await ensureStash()
  const id = docId(doc)
  const staticTags = [tags.all()]
  if (id !== undefined) staticTags.push(tags.doc(collection, id))
  if (options.as !== undefined && options.as !== id) {
    staticTags.push(tags.doc(collection, options.as))
    const risk = riskyAliasReason(options.as)
    if (risk)
      warnOnce(
        `alias:${collection}:${options.as}`,
        `cacheDoc('${collection}', { as: '${options.as}' }) — alias ${risk}. Over-busts only (never stale), but rename the idField value to avoid coincidental cache purges.`,
      )
  }
  if (doc == null && options.as === undefined) staticTags.push(tags.list(collection))
  await finish({ kind: 'doc', collection, as: options.as ?? id, staticTags, value: doc, slug: collection, options })
  return doc
}

/**
 * Tag an id-list read (a Payload result, an array of docs, or a plain id array). Tags:
 * `all` + the collection's list tag (scoped via `list`, bare otherwise) — deliberately NO
 * per-doc tags and no walk: this entry is membership/order only, and each item renders
 * through its own id-keyed `cacheDoc` getter. Content edits never touch it; membership
 * events (and the scope's declared fields) do.
 */
export async function cacheIds<T>(result: T, collection: string, options: CacheIdsOptions = {}): Promise<T> {
  await ensureStash()
  const items: unknown[] = Array.isArray(result) ? result : ((result as { docs?: unknown[] } | null)?.docs ?? [])
  const name = options.label ?? `ids:${collection}${options.list ? `:${options.list}` : ''}`

  // Teach: full docs passed here means content is (presumably) rendered from this entry,
  // but ids-only tagging will NOT refresh it on content edits. Upload plumbing is exempt:
  // Payload returns it even under `select: {}`, so on an upload collection those keys say
  // nothing about what the getter selected.
  const uploadMeta = ['filename', 'filesize', 'mimeType', 'width', 'height', 'focalX', 'focalY', 'url', 'thumbnailURL', 'sizes']
  const contentKeys = items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .flatMap((doc) => Object.keys(doc))
    .filter((key) => !['id', 'createdAt', 'updatedAt', '_status', ...uploadMeta].includes(key))
  if (contentKeys.length)
    warnOnce(
      `content:${name}`,
      `${name} received docs carrying content (${[...new Set(contentKeys)].slice(0, 5).join(', ')}…) — cacheIds tags membership only. Fetch with select: {} and render items through id-keyed cacheDoc getters, or content edits won't refresh this entry.`,
    )

  // Police the scope: hooks bust only DECLARED scopes, so an undeclared one goes stale on
  // reorders. Only when the plugin's stash is present — without it (plugin never ran in
  // this process) declaration status is unknowable and the warning would be spurious.
  const stashedLists = getState().lists
  const declared = stashedLists?.[collection]
  const undeclared = stashedLists !== undefined && options.list !== undefined && !(declared ?? []).includes(options.list)
  if (undeclared)
    warnOnce(
      `scope:${name}`,
      `${name} carries undeclared list scope '${options.list}' — reorders won't bust it. Declare it: revalidatePlugin({ collections: { ${collection}: { lists: { ${options.list}: { fields: ['<sort/filter fields>'] } } } } }).`,
    )

  const statics = withDraftVariants([tags.all(), tags.list(collection, { scope: options.list }), ...(options.tags ?? [])], options.draft)
  recordRead({
    kind: 'ids',
    collection,
    list: options.list,
    ...(undeclared ? { undeclared } : {}),
    draft: options.draft ?? false,
    label: options.label,
    staticTags: statics,
    depTags: [],
    bakedIn: [],
    capped: false,
  })
  await applyCacheTags([...new Set(statics)])
  return result
}

/** Tag a global read. Tags: `all`, `global:{slug}`, baked-in docs (dev-flagged), draft variants. */
export async function cacheGlobal<T>(doc: T, slug: string, options: CacheDocOptions = {}): Promise<T> {
  await ensureStash()
  await finish({ kind: 'global', global: slug, staticTags: [tags.all(), tags.global(slug)], value: doc, slug, options })
  return doc
}

/** Manually bust one doc's tags (both lanes) — for flows outside the auto hooks. */
export const revalidateDoc = (slug: string, id: string | number): Promise<void> =>
  bust(
    [
      { tag: tags.doc(slug, id), reason: 'doc' },
      { tag: tags.doc(slug, id, { draft: true }), reason: 'doc' },
    ],
    { slug, id, operation: 'manual', lane: 'published' },
    'manual',
  )

/** Manually bust a collection's list tags — bare + every declared scope, both lanes. */
export const revalidateList = (slug: string): Promise<void> =>
  bust(
    [undefined, ...(getState().lists?.[slug] ?? [])].flatMap((scope) => [
      { tag: tags.list(slug, { scope }), reason: 'list' as const },
      { tag: tags.list(slug, { scope, draft: true }), reason: 'list' as const },
    ]),
    { slug, operation: 'manual', lane: 'published' },
    'manual',
  )

/** Manually bust a global's tags (both lanes). */
export const revalidateGlobal = (slug: string): Promise<void> =>
  bust(
    [
      { tag: tags.global(slug), reason: 'global' },
      { tag: tags.global(slug, { draft: true }), reason: 'global' },
    ],
    { slug, operation: 'manual', lane: 'published' },
    'manual',
  )

/** Bust every entry the `./cache` helpers tagged — they all carry `all`. */
export const revalidateAll = (): Promise<void> =>
  bust([{ tag: tags.all(), reason: 'all' }], { slug: 'all', operation: 'manual', lane: 'published' }, 'manual')

export { getPayloadClient }
export { tags }
export type { WalkOptions }
