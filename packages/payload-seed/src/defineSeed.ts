import type { CollectionSlug, GlobalSlug } from 'payload'
import { file, ref } from './refs'
import type { DefinitionFor, ExactFor, SeedDisabledMarker, SeedTokens, ShapeFor } from './types'

const tokens = { ref, file }

/**
 * Define seed data for a collection or a global. Pass the slug and a builder; the second parameter
 * types itself from the slug — an array of records for a collection (each with a local `_key` handle
 * and an optional `_file` attaching a source file), or a single data object for a global (no `_key`).
 * Records are typed against the app's generated Payload types, relationship fields accept `ref()`
 * tokens, and unknown fields are rejected. Default-export one per `seed.ts` file, then wire it into
 * `seedPlugin({ definitions })`.
 *
 * This is a single call signature (not an overload set), so a bad field reports against the resolved
 * record type — the same specific error the collection/global shapes give on their own.
 *
 *   export default defineSeed('images', ({ file }) => [
 *     { _key: 'hero', _file: file('hero.jpg'), alt: 'A lighthouse at dusk' },
 *   ])
 *
 *   export default defineSeed('site-settings', ({ ref }) => ({
 *     featured: ref('services', 'consulting'),
 *   }))
 *
 * `opts.disabled` skips the definition at seed time without removing it (so the generated seed-ref
 * types stay stable) — the engine warns, and optional refs pointing at it are dropped. Collections
 * that declare `custom.seedDisabled` (e.g. a plugin detecting missing credentials) are skipped the
 * same way automatically, so you usually don't need to set this yourself.
 */
export function defineSeed<TSlug extends CollectionSlug | GlobalSlug, const T extends ShapeFor<TSlug>>(
  slug: TSlug,
  build: (tokens: SeedTokens) => ExactFor<T, ShapeFor<TSlug>>,
  opts?: { disabled?: SeedDisabledMarker },
): DefinitionFor<TSlug> {
  // Classify collection vs global from the builder's shape (collection → array, global → object).
  // The ref/file tokens are pure constructors, so this eager call has no side effects and resolves
  // no refs; it only decides `kind`. The engine calls `build` again at seed time.
  let built: unknown
  try {
    built = (build as (t: SeedTokens) => unknown)(tokens)
  } catch (e) {
    throw new Error(`[payload-seed] defineSeed('${slug}'): builder threw during classification: ${e instanceof Error ? e.message : String(e)}`)
  }
  const kind = Array.isArray(built) ? 'collection' : 'global'
  return { kind, slug, build, ...(opts?.disabled !== undefined ? { disabled: opts.disabled } : {}) } as unknown as DefinitionFor<TSlug>
}

export { tokens }
