import type { Endpoint } from 'payload'

import { isRecord } from '../lib/isRecord'
import { devToolsEnabled } from '../options'

export function createActivateIconSetEndpoint(enabled?: boolean): Endpoint {
  return {
    path: '/dev/icons/activate',
    method: 'post',
    handler: async (req) => {
      if (!devToolsEnabled(enabled)) return Response.json({ error: 'Not found' }, { status: 404 })

      const marker = req.payload.config.custom?.payloadIcons
      const iconSetSlug = isRecord(marker) && typeof marker.iconSetSlug === 'string' ? marker.iconSetSlug : undefined
      if (!iconSetSlug) return Response.json({ error: 'payload-icons (with its iconSet collection) is not installed.' }, { status: 400 })

      const raw: unknown = await req.json?.().catch(() => null)
      const id = isRecord(raw) && (typeof raw.id === 'string' || typeof raw.id === 'number') ? raw.id : undefined
      if (!id) return Response.json({ error: 'Missing icon set `id`.' }, { status: 400 })

      try {
        await req.payload.update({
          collection: iconSetSlug,
          id,
          data: { active: true, _status: 'published' },
          draft: false,
        })
        return Response.json({ success: true })
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : 'Failed to activate icon set.' }, { status: 500 })
      }
    },
  }
}
