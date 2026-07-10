import type { PayloadRequest } from 'payload'

/** The `:id` route param as a string (`''` when absent) — shared by the transform + purge endpoints. */
export const routeId = (req: PayloadRequest): string => {
  const raw = req.routeParams?.id
  return raw == null ? '' : String(raw)
}
