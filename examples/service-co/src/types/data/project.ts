import type { RelId } from './primitives'

export type GalleryItem = { image: RelId }

export type Project = {
  id: RelId
  title: string
  slug: string
  client?: string | null
  location?: string | null
  year?: number | null
  summary?: string | null
  description?: string | null
  featured?: boolean | null
  coverImage?: RelId | null
  gallery?: GalleryItem[] | null
  video?: RelId | null
  services?: RelId[] | null
}
