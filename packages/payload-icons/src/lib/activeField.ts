import type { CheckboxField, CollectionAfterChangeHook, CollectionSlug } from 'payload'

/**
 * The single-active toggle for the `iconSet` collection. The frontend renders
 * whichever set has `active: true` (queried `limit: 1`), so flipping this on
 * one set re-skins every `<Icon>` across the site. The single-active invariant
 * is enforced by {@link enforceSingleActive}.
 */
export const activeField: CheckboxField = {
  name: 'active',
  type: 'checkbox',
  defaultValue: false,
  admin: {
    description: 'Render this set across the frontend. Activating a set deactivates the others.',
  },
}

/** Marker in the hook `context` so the cascade of deactivations we trigger
 *  doesn't recurse back into this hook. */
const CASCADE = 'iconSetEnforceSingleActive'

/**
 * `afterChange` hook enforcing the single-active invariant: when a set is saved
 * `active`, every other set in the collection is flipped `active: false` (in the
 * same request/transaction). Runs after the write commits so a concurrent read
 * can't re-cache a stale "two actives" state.
 *
 * Self-contained — no `@pro-laico/core` APF dependency. Other sets are updated
 * with the same `req` (one transaction) and a `context` flag so the nested
 * `afterChange` they trigger is a no-op.
 */
export const enforceSingleActive: CollectionAfterChangeHook = async ({ doc, req, collection, context }) => {
  if (!doc?.active || context?.[CASCADE]) return doc
  await req.payload.update({
    collection: collection.slug as CollectionSlug,
    where: { and: [{ active: { equals: true } }, { id: { not_equals: doc.id } }] },
    data: { active: false },
    req,
    context: { [CASCADE]: true },
    overrideAccess: true,
  })
  return doc
}
