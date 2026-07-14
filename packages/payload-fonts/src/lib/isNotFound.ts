import { isRecord } from './isRecord'

export const isNotFound = (err: unknown): boolean => (isRecord(err) && err.status === 404) || (err instanceof Error && err.name === 'NotFound')
