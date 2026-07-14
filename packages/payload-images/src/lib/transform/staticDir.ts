import path from 'node:path'
import type { Payload } from 'payload'

export const resolveStaticDir = (payload: Payload, slug: string): string => {
  const collections = payload.collections as Record<string, { config?: { upload?: { staticDir?: string } } }> //TODO: replace `as` cast with proper typing
  const dir = collections?.[slug]?.config?.upload?.staticDir
  const base = dir?.length ? dir : slug
  return path.isAbsolute(base) ? base : path.resolve(process.cwd(), base)
}
