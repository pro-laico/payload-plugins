import type { PayloadRequest } from 'payload'

export const defaultAccess = (req: PayloadRequest): boolean => Boolean(req.user && req.user.collection === req.payload.config.admin.user)
