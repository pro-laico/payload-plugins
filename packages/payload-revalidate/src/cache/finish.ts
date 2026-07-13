import { createOnce } from '../lib/once'
import { recordRead } from '../lib/observe/registry'
import { collectDepTags, indexSchema } from '../lib/walk/collectTags'
import type { BakedEmbed, FinishInput, IndexSource } from '../types'

/** The shared tail of every `./cache` read — bake-in walk, advisories, tag-limit
 *  enforcement, observation record, and the actual `cacheTag` application. */

const dev = (): boolean => process.env.NODE_ENV === 'development'

/** Warned-once registry so each read shape logs each advisory once per process (dev only). */
const warnedOnce = createOnce()
export const warnOnce = (key: string, message: string): void => {
  if (dev() && warnedOnce(key)) console.warn(`[payload-revalidate] ${message}`)
}

/** Failure paths alert once per key in EVERY environment: each of these means entries are
 *  materializing under-tagged (silently unbustable) — that must be visible in prod logs,
 *  where until now the plugin degraded with zero signal. */
const alertedOnce = createOnce()
export const alertOnce = (key: string, message: string, cause?: unknown): void => {
  if (alertedOnce(key)) console.error(`[payload-revalidate] ${message}`, cause instanceof Error ? cause.message : (cause ?? ''))
}

/** Next allows at most 128 tags per cache entry — tags past the limit are dropped. */
const NEXT_MAX_TAGS = 128

/** Apply Next's cacheTag without exploding outside a `'use cache'` scope. */
export const applyCacheTags = async (allTags: string[]): Promise<void> => {
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

/** Add `:draft` variants for a draft-scoped read — every tag except the `all` tag (passed
 *  in exactly, since its prefixed form comes from the caller's builders). */
export const withDraftVariants = (base: string[], draft: boolean | undefined, allTag: string): string[] => {
  if (!draft) return base
  return [...base, ...base.filter((tag) => tag !== allTag).map((tag) => `${tag}:draft`)]
}

/** Shared tail for doc/global reads: walk for bake-ins, advise, record, cacheTag. The
 *  schema comes off the handle's own config — a live handle always carries it, so the walk
 *  can never be skipped for an unreachable config. */
export const finish = async ({
  payload,
  tags,
  observe,
  kind,
  collection,
  global,
  as,
  staticTags,
  value,
  slug,
  options,
}: FinishInput): Promise<void> => {
  const index = options.walk === false || value == null ? null : indexSchema(payload.config as unknown as IndexSource)
  const entity = index ? (kind === 'global' ? index.global(slug) : index.collection(slug)) : undefined
  const walked =
    index && entity
      ? collectDepTags(value, entity.fields, index, options.walk === false ? undefined : options.walk, tags)
      : { tags: [], embeds: [] as BakedEmbed[], capped: false }

  const name = options.label ?? `${kind}:${slug}${as !== undefined ? `:${as}` : ''}`
  if (walked.capped)
    warnOnce(`cap:${name}`, `${name}: bake-in walk hit maxTags — this entry may under-tag (raise walk.maxTags or narrow the read).`)
  if (walked.embeds.length)
    warnOnce(
      `baked:${name}`,
      `${name} bakes in ${walked.embeds.length} populated doc(s): ${walked.embeds.map((e) => `${e.via} → ${e.tag}`).join(', ')} — fetch shallow (depth: 0) and render references through id-keyed cacheDoc getters for surgical busts.`,
    )

  const statics = withDraftVariants([...staticTags, ...(options.tags ?? [])], options.draft, tags.all())
  const deps = withDraftVariants(walked.tags, options.draft, tags.all())

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

  recordRead(observe, {
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
