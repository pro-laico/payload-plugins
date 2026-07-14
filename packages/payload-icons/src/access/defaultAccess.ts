import type { Access } from 'payload'

export const defaultReadAccess: Access = () => true

export const defaultAdminAccess: Access = ({ req }) => Boolean(req.user && req.user.collection === req.payload.config.admin.user)
