import path from 'node:path'
import type { Payload } from 'payload'

/** Resolve a collection's on-disk upload directory (absolute). */
export const resolveStaticDir = (payload: Payload, slug: string): string => {
  const collections = payload.collections as Record<string, { config?: { upload?: { staticDir?: string } } }> //EXCUSE: indexes the app's generated slug map by a runtime string; only the probed shape is claimed
  const dir = collections?.[slug]?.config?.upload?.staticDir
  const base = dir?.length ? dir : slug
  return path.isAbsolute(base) ? base : path.resolve(process.cwd(), base)
}
