import type { PayloadRequest } from 'payload'

/** Default upload/read gate: allow only a logged-in user from the configured admin
 *  collection. Override per-plugin via the `access` option. */
export const defaultAccess = (req: PayloadRequest): boolean => Boolean(req.user && req.user.collection === req.payload.config.admin.user)
