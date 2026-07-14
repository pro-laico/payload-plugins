import path from 'node:path'
import type { Payload } from 'payload'

export const resolveStaticDir = (payload: Payload, slug: string): string => {
  const dir = payload.collections[slug]?.config?.upload?.staticDir
  const base = dir?.length ? dir : slug
  return path.isAbsolute(base) ? base : path.resolve(process.cwd(), base)
}
