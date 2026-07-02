import type { CollectionSlug, Endpoint } from 'payload'
import { devToolsEnabled } from '../options'

/**
 * `POST /api/dev/icons/activate` (body `{ id }`) — activate an icon set, publishing the change so
 * the frontend re-skins immediately. Powers the set switcher on the `/dev/icons` page: flipping
 * between sets to visually compare them is exactly the kind of one-click dev action this plugin
 * exists for. payload-icons' own single-active hook deactivates the others. Dev-only (404s
 * otherwise); requires payload-icons (discovered via its config marker).
 */
export function createActivateIconSetEndpoint(enabled?: boolean): Endpoint {
  return {
    path: '/dev/icons/activate',
    method: 'post',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      const marker = req.payload.config.custom?.payloadIcons as { iconSetSlug?: string | null } | undefined
      if (!marker?.iconSetSlug)
        return Response.json({ error: 'payload-icons (with its iconSet collection) is not installed.' }, { status: 400 })

      const body = (await req.json?.().catch(() => null)) as { id?: string | number } | null
      if (!body?.id) return Response.json({ error: 'Missing icon set `id`.' }, { status: 400 })

      try {
        await req.payload.update({
          collection: marker.iconSetSlug as CollectionSlug,
          id: body.id,
          data: { active: true, _status: 'published' },
          draft: false,
          overrideAccess: true,
        })
        return Response.json({ success: true })
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : 'Failed to activate icon set.' }, { status: 500 })
      }
    },
  }
}
