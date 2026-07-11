import { bust } from '../lib/bust'
import { getState, tags } from '../tags'
import type { Bust, SeedResultLike } from '../types'

/** The keyed after-seed listener slot `@pro-laico/payload-seed` invokes at the end of
 *  `runSeed`. Shared via `Symbol.for` — no import in either direction, same contract
 *  style as `custom.seedAsset` / `custom.seedDisabled`, just for functions. */
const AFTER_SEED_SLOT = Symbol.for('pro-laico.payload-seed.afterSeed')

/**
 * The post-seed flush: the seed engine writes with `context.disableRevalidate` (per-write
 * hooks stay quiet), leaving the cached surface stale — this busts it once at the end.
 * Per touched collection the list tags (both lanes) and its static `extraTags`, per seeded
 * global its tags, and finally `all`. The `all` bust is what makes a seed CORRECT, not a
 * sledgehammer: a seed run clears and recreates docs with new ids, so doc/alias-keyed
 * entries can't be enumerated — and since every `./cache` entry carries `all`, one tag
 * flushes exactly the plugin-tagged surface and nothing else. The per-slug tags ride along
 * so the event log shows what the run actually touched. `extraTags` must be explicit,
 * though: an entry tagged ONLY through one (a scope inlining icons, tagged `payload-icons`)
 * never went through `./cache`, carries no `all`, and would otherwise survive the reseed.
 */
export const seedBusts = (result: SeedResultLike): Bust[] => {
  const slugs = new Set<string>([...Object.keys(result.created ?? {}), ...(result.collections ?? [])])
  const declaredLists = getState().lists ?? {}
  const declaredExtras = getState().extraTags ?? {}
  const declaredRules = getState().rules ?? []
  const busts: Bust[] = []
  for (const slug of slugs) {
    for (const scope of [undefined, ...(declaredLists[slug] ?? [])]) {
      busts.push({ tag: tags.list(slug, { scope }), reason: 'list' }, { tag: tags.list(slug, { scope, draft: true }), reason: 'list' })
    }
    for (const tag of declaredExtras[slug] ?? []) busts.push({ tag, reason: 'extra' })
    // Rule targets, same rationale as extraTags: they tag surfaces outside `./cache`
    // (no `all` tag), and the reseed recreated every doc the rule watches.
    for (const rule of declaredRules) if (rule.on === slug) busts.push(...rule.bust.map((tag) => ({ tag, reason: 'rule' as const })))
  }
  for (const slug of result.globals ?? []) {
    busts.push({ tag: tags.global(slug), reason: 'global' }, { tag: tags.global(slug, { draft: true }), reason: 'global' })
  }
  if (busts.length) busts.push({ tag: tags.all(), reason: 'all' })
  return busts
}

/** Called from the plugin factory: register (idempotently — keyed record, HMR-safe) the
 *  listener payload-seed invokes with the run's result. */
export const registerSeedListener = (): void => {
  const slot = globalThis as Record<symbol, unknown>
  const listeners = (slot[AFTER_SEED_SLOT] as Record<string, unknown> | undefined) ?? {}
  listeners['pro-laico/payload-revalidate'] = async (result: SeedResultLike): Promise<void> => {
    await bust(seedBusts(result), { slug: 'seed', operation: 'seed', lane: 'published' }, 'seed')
  }
  slot[AFTER_SEED_SLOT] = listeners
}
