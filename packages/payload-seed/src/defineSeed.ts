import type { CollectionSlug, GlobalSlug } from 'payload'

import { file, ref } from './refs'
import type { DefinitionFor, ExactFor, SeedDisabledMarker, SeedTokens, ShapeFor } from './types'

const tokens = { ref, file }

export function defineSeed<TSlug extends CollectionSlug | GlobalSlug, const T extends ShapeFor<TSlug>>(
  slug: TSlug,
  build: (tokens: SeedTokens) => ExactFor<T, ShapeFor<TSlug>>,
  opts?: { disabled?: SeedDisabledMarker },
): DefinitionFor<TSlug> {
  let built: unknown
  try {
    built = build(tokens)
  } catch (e) {
    throw new Error(`[payload-seed] defineSeed('${slug}'): builder threw during classification: ${e instanceof Error ? e.message : String(e)}`)
  }
  const kind = Array.isArray(built) ? 'collection' : 'global'
  //EXCUSE: DefinitionFor<TSlug> is a deferred conditional type (collection-vs-global on the generic TSlug); TS can't verify a runtime-built object matches it, so the return needs a bridge cast
  return { kind, slug, build, ...(opts?.disabled !== undefined ? { disabled: opts.disabled } : {}) } as unknown as DefinitionFor<TSlug>
}

export { tokens }
