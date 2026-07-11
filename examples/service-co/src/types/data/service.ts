import type { RelId } from './primitives'

export type Service = {
  id: RelId
  title: string
  slug: string
  summary?: string | null
  order?: number | null
  icon?: RelId | null
  image?: RelId | null
}
