import type { Access } from 'payload'

/** Logged in, on any collection. The baseline gate for a plugin's own collections — a consumer
 * replaces it through `collections.<name>.access`, which shallow-merges over this. */
export const authd: Access = ({ req }) => Boolean(req.user)

/** Public read. Paired with `authd` on write, this is the shape of a collection whose content is
 * meant to be served to anonymous traffic. */
export const anyone: Access = () => true
