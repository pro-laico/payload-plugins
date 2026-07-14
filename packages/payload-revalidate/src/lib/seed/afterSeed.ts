import { bust } from '../bust'
import type { Bust, SeedFlushState, SeedResultLike } from '../../types'

const AFTER_SEED_SLOT = Symbol.for('pro-laico.payload-seed.afterSeed')

export const seedBusts = (state: SeedFlushState, result: SeedResultLike): Bust[] => {
  const { tags, lists, extraTags, rules } = state
  const slugs = new Set<string>([...Object.keys(result.created ?? {}), ...(result.collections ?? [])])
  const busts: Bust[] = []
  for (const slug of slugs) {
    for (const scope of [undefined, ...(lists[slug] ?? [])]) {
      busts.push({ tag: tags.list(slug, { scope }), reason: 'list' }, { tag: tags.list(slug, { scope, draft: true }), reason: 'list' })
    }
    for (const tag of extraTags[slug] ?? []) busts.push({ tag, reason: 'extra' })
    for (const rule of rules) if (rule.on === slug) busts.push(...rule.bust.map((tag) => ({ tag, reason: 'rule' as const })))
  }
  for (const slug of result.globals ?? []) {
    busts.push({ tag: tags.global(slug), reason: 'global' }, { tag: tags.global(slug, { draft: true }), reason: 'global' })
  }
  if (busts.length) busts.push({ tag: tags.all(), reason: 'all' })
  return busts
}

export const registerSeedListener = (state: SeedFlushState): void => {
  const slot = globalThis as Record<symbol, unknown> //TODO: replace `as` cast with proper typing
  const listeners = (slot[AFTER_SEED_SLOT] as Record<string, unknown> | undefined) ?? {} //TODO: replace `as` cast with proper typing
  listeners['pro-laico/payload-revalidate'] = async (result: SeedResultLike): Promise<void> => {
    await bust(seedBusts(state, result), { slug: 'seed', operation: 'seed', lane: 'published' }, 'seed', state.observe)
  }
  slot[AFTER_SEED_SLOT] = listeners
}
