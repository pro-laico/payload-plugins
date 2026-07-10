// Light view models for the frontend. We deliberately don't import Payload's generated types here:
// these name only the fields the site renders. Every read is `depth: 0` (the payload-revalidate
// atomic model — references stay ids and resolve through their own id-keyed getters), so every
// relationship field is a bare id.

/** A `depth: 0` relationship value — the referenced doc's id. */
export type RelId = string | number

export type MediaImage = {
  id: RelId
  alt?: string | null
  src?: string | null
  srcset?: string | null
  croppedBlurHash?: string | null
}

export type IconDoc = { id: RelId; svgString?: string | null; filename?: string | null }

/** One Mux playback row — the virtual URLs are computed on read from the stored playback id. */
export type MuxPlayback = { playbackId?: string | null; playbackUrl?: string | null; posterUrl?: string | null; gifUrl?: string | null }
export type MuxVideoDoc = { id: RelId; title?: string | null; playbackOptions?: MuxPlayback[] | null }

export type Service = {
  id: RelId
  title: string
  slug: string
  summary?: string | null
  order?: number | null
  icon?: RelId | null
  image?: RelId | null
}

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

export type TeamMember = {
  id: RelId
  name: string
  role?: string | null
  bio?: string | null
  order?: number | null
  photo?: RelId | null
}

export type Testimonial = {
  id: RelId
  quote: string
  author: string
  company?: string | null
  project?: RelId | null
}

export type SiteSettings = {
  companyName?: string | null
  tagline?: string | null
  description?: string | null
  heroImage?: RelId | null
  showreel?: RelId | null
  featuredProject?: RelId | null
  contact?: { email?: string | null; phone?: string | null; address?: string | null } | null
}

/** The first playable Mux playback row (has a playback id), or undefined. */
export const firstPlayback = (video: MuxVideoDoc | null | undefined): MuxPlayback | undefined =>
  video?.playbackOptions?.find((p) => p.playbackId) ?? undefined
