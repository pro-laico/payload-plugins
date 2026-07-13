import type { CollectionSlug, Endpoint } from 'payload'

import { ICON_REQUEST_SLUG } from '../collections/IconRequest'

/** Mounted under Payload's API route: `DELETE {routes.api}/payload-icons/icon-requests`. */
export const CLEAR_ICON_REQUESTS_PATH = '/payload-icons/icon-requests'

/**
 * The endpoint behind the IconSet usage panel's "Clear runtime requests" button:
 * deletes every row in the `iconRequest` collection so the panel's live miss list
 * starts fresh (e.g. after you've added the missing icons). Registered by the
 * plugin only when `trackRequests` is on.
 *
 * Runs entirely on `req.payload` — Payload's REST layer authenticated the request
 * (`req.user`), and the delete keeps `overrideAccess: false` so the collection's
 * own access still applies. A no-op (reported as such) when tracking isn't enabled.
 */
export function createClearIconRequestsEndpoint(): Endpoint {
  return {
    path: CLEAR_ICON_REQUESTS_PATH,
    method: 'delete',
    handler: async (req) => {
      try {
        if (!req.user) return Response.json({ success: false, message: 'Not authorized to clear icon requests.' }, { status: 401 })
        if (!(req.payload.collections as Record<string, unknown>)?.[ICON_REQUEST_SLUG]) {
          return Response.json({ success: false, message: 'Request tracking is not enabled.' })
        }

        const res = await req.payload.delete({
          collection: ICON_REQUEST_SLUG as CollectionSlug,
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
