import type { CollectionBeforeChangeHook, CollectionSlug } from 'payload'

/** Hook-`context` flag so the cascade of deactivations we trigger doesn't recurse. */
const CASCADE = 'iconSetEnforceSingleActive'

/**
 * `beforeChange` hook enforcing the single-active invariant, adapted (standalone,
 * no `@pro-laico/core`) from Atomic's `unsetActive`. When a set is saved
 * `active`, every other set in the **same status lane** is flipped `active:
 * false` in the same request/transaction:
 *
 * - The `_status: draft | published` filter scopes the deactivation to the lane
 *   being written, so staging a new active set as a *draft* doesn't disturb the
 *   live (published) active set — the swap only goes live on publish. (Skipped
 *   when the collection has no drafts.)
 * - It runs in `beforeChange` and **rethrows** on failure, so a failed
 *   deactivation rolls the whole save back atomically rather than leaving two
 *   active sets.
 */
export const enforceSingleActive: CollectionBeforeChangeHook = async ({ data, originalDoc, collection, req, context }) => {
  if (!data?.active || context[CASCADE]) return data

  const hasDrafts = Boolean((collection.versions as { drafts?: unknown } | undefined)?.drafts)
  const draft = hasDrafts && data._status === 'draft'
  const id = originalDoc?.id // undefined on create — then there are no other rows to exclude

  try {
    await req.payload.update({
      req,
      draft,
      collection: collection.slug as CollectionSlug,
      // `active` isn't a field on every collection slug, so the bulk-update `data`
      // union has no matching branch under a partial schema — cast past it.
      data: { active: false } as unknown as never,
      where: {
        active: { equals: true },
        ...(id != null ? { id: { not_equals: id } } : {}),
        ...(hasDrafts ? { _status: { equals: draft ? 'draft' : 'published' } } : {}),
      },
      context: { [CASCADE]: true },
      overrideAccess: true,
    })
  } catch (err) {
    // Rethrow WITH context: the raw adapter/validation error gives no hint it came from the
    // single-active cascade, leaving the "why did my save fail?" story untold.
    const inner = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[payload-icons] could not deactivate the other active ${collection.slug} set(s) — the save was rolled back to avoid two active sets. Cause: ${inner}`,
      { cause: err },
    )
  }

  return data
}
