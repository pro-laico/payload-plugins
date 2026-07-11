import type { Access } from 'payload'

/** Default write gate: allow only a logged-in user from the configured admin collection.
 *  Override per-operation via the plugin's `access` option. */
export const defaultAdminAccess: Access = ({ req }) => Boolean(req.user && req.user.collection === req.payload.config.admin.user)

/** Default read gate: public. Icons are frontend assets, so anyone can read them; tighten this
 *  via `access.read` if your icons are private. */
export const defaultReadAccess: Access = () => true
