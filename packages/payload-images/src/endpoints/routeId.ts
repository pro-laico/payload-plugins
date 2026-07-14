import type { PayloadRequest } from 'payload'

export const routeId = (req: PayloadRequest): string => {
  const raw = req.routeParams?.id
  return raw == null ? '' : String(raw)
}
