import type { Endpoint } from 'payload'

import { ICON_REQUEST_SLUG } from '../collections/IconRequest'

export const CLEAR_ICON_REQUESTS_PATH = '/payload-icons/icon-requests'

export function createClearIconRequestsEndpoint(): Endpoint {
  return {
    path: CLEAR_ICON_REQUESTS_PATH,
    method: 'delete',
    handler: async (req) => {
      try {
        if (!req.user) return Response.json({ success: false, message: 'Not authorized to clear icon requests.' }, { status: 401 })
        if (!req.payload.collections?.[ICON_REQUEST_SLUG]) {
          return Response.json({ success: false, message: 'Request tracking is not enabled.' })
        }

        const res = await req.payload.delete({
          collection: ICON_REQUEST_SLUG,
          where: { id: { exists: true } },
          user: req.user,
          overrideAccess: false,
        })
        const count = res.docs?.length ?? 0
        return Response.json({ success: true, message: `Cleared ${count} runtime request${count === 1 ? '' : 's'}.` })
      } catch (error) {
        return Response.json(
          { success: false, message: error instanceof Error ? error.message : 'Failed to clear icon requests.' },
          { status: 500 },
        )
      }
    },
  }
}
