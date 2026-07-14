import type { CollectionBeforeChangeHook, CollectionSlug } from 'payload'

const CASCADE = 'iconSetEnforceSingleActive'

export const enforceSingleActive: CollectionBeforeChangeHook = async ({ data, originalDoc, collection, req, context }) => {
  if (!data?.active || context[CASCADE]) return data

  const hasDrafts = Boolean((collection.versions as { drafts?: unknown } | undefined)?.drafts) //TODO: replace `as` cast with proper typing
  const draft = hasDrafts && data._status === 'draft'
  const id = originalDoc?.id

  try {
    await req.payload.update({
      req,
      draft,
      collection: collection.slug as CollectionSlug, //TODO: replace `as` cast with proper typing
      data: { active: false } as unknown as never, //TODO: replace `as` cast with proper typing
      where: {
        active: { equals: true },
        ...(id != null ? { id: { not_equals: id } } : {}),
        ...(hasDrafts ? { _status: { equals: draft ? 'draft' : 'published' } } : {}),
      },
      context: { [CASCADE]: true },
    })
  } catch (err) {
    const inner = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[payload-icons] could not deactivate the other active ${collection.slug} set(s) — the save was rolled back to avoid two active sets. Cause: ${inner}`,
      { cause: err },
    )
  }

  return data
}
