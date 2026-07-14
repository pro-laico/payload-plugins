import type { CollectionSlug, Endpoint } from 'payload'

import { devToolsEnabled } from '../options'

export function createActivateIconSetEndpoint(enabled?: boolean): Endpoint {
  return {
    path: '/dev/icons/activate',
    method: 'post',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      //TODO: replace `as` cast with proper typing
      const marker = req.payload.config.custom?.payloadIcons as { iconSetSlug?: string | null } | undefined
      if (!marker?.iconSetSlug)
        return Response.json({ error: 'payload-icons (with its iconSet collection) is not installed.' }, { status: 400 })

      const body = (await req.json?.().catch(() => null)) as { id?: string | number } | null //TODO: replace `as` cast with proper typing
      if (!body?.id) return Response.json({ error: 'Missing icon set `id`.' }, { status: 400 })

      try {
        await req.payload.update({
          collection: marker.iconSetSlug as CollectionSlug, //TODO: replace `as` cast with proper typing
          id: body.id,
          // Through `never`: the app's generated update-data union only knows the app's own
          // collections — hosts without payload-icons' iconSet can't type `active`.
          data: { active: true, _status: 'published' } as never, //TODO: replace `as` cast with proper typing
          draft: false,
        })
        return Response.json({ success: true })
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : 'Failed to activate icon set.' }, { status: 500 })
      }
    },
  }
}
