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
    built = (build as (t: SeedTokens) => unknown)(tokens) //TODO: replace `as` cast with proper typing
  } catch (e) {
    throw new Error(`[payload-seed] defineSeed('${slug}'): builder threw during classification: ${e instanceof Error ? e.message : String(e)}`)
  }
  const kind = Array.isArray(built) ? 'collection' : 'global'
  //TODO: replace `as unknown as` cast with proper typing
  return { kind, slug, build, ...(opts?.disabled !== undefined ? { disabled: opts.disabled } : {}) } as unknown as DefinitionFor<TSlug>
}

export { tokens }
