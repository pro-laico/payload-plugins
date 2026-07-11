import type { RelId } from './primitives'

export type SiteSettings = {
  companyName?: string | null
  tagline?: string | null
  description?: string | null
  heroImage?: RelId | null
  showreel?: RelId | null
  featuredProject?: RelId | null
  contact?: { email?: string | null; phone?: string | null; address?: string | null } | null
}
