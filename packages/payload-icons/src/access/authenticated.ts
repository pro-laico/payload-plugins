import type { Access } from 'payload'

/** Access gate: any logged-in user. Used for the `iconSet` / `iconRequest`
 *  collections, which are author/diagnostic data rather than public assets. */
export const authd: Access = ({ req }) => Boolean(req.user)
