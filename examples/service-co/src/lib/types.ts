// Light view models for the frontend. We deliberately don't import Payload's generated types here:
// these name only the fields the site renders, and every relationship is `Doc | id` (what a
// `depth`-limited query returns), so the pages stay decoupled from the full generated shapes.

export type MediaImage = {
  id: string | number
  alt?: string | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  filename?: string | null
  url?: string | null
}

export type IconDoc = { id: string | number; svgString?: string | null; filename?: string | null }

/** One Mux playback row — the virtual URLs are computed on read from the stored playback id. */
export type MuxPlayback = { playbackId?: string | null; playbackUrl?: string | null; posterUrl?: string | null; gifUrl?: string | null }
export type MuxVideoDoc = { id: string | number; title?: string | null; playbackOptions?: MuxPlayback[] | null }

export type Service = {
  id: string | number
  title: string
  slug: string
  summary?: string | null
  order?: number | null
  icon?: IconDoc | string | null
  image?: MediaImage | string | null
}

export type GalleryItem = { image?: MediaImage | string | null }

export type Project = {
  id: string | number
  title: string
  slug: string
  client?: string | null
  location?: string | null
  year?: number | null
  summary?: string | null
  description?: string | null
  featured?: boolean | null
  coverImage?: MediaImage | string | null
  gallery?: GalleryItem[] | null
  video?: MuxVideoDoc | string | null
  services?: (Service | string)[] | null
}

export type TeamMember = {
  id: string | number
  name: string
  role?: string | null
  bio?: string | null
  order?: number | null
  photo?: MediaImage | string | null
}

export type Testimonial = {
  id: string | number
  quote: string
  author: string
  company?: string | null
  project?: Project | string | null
}

export type SiteSettings = {
  companyName?: string | null
  tagline?: string | null
  description?: string | null
  heroImage?: MediaImage | string | null
  showreel?: MuxVideoDoc | string | null
  featuredProject?: Project | string | null
  contact?: { email?: string | null; phone?: string | null; address?: string | null } | null
}

/** Narrow a `Doc | id | null` relationship to the populated doc, or `undefined` when it's just an id. */
export const asDoc = <T>(value: T | string | number | null | undefined): T | undefined =>
  value && typeof value === 'object' ? (value as T) : undefined

/** The first playable Mux playback row (has a playback id), or undefined. */
export const firstPlayback = (video: MuxVideoDoc | string | null | undefined): MuxPlayback | undefined => {
  const doc = asDoc<MuxVideoDoc>(video)
  return doc?.playbackOptions?.find((p) => p.playbackId) ?? undefined
}
