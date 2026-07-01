import 'server-only'
import config from '@payload-config'
import { getPayload } from 'payload'
import type { Project, Service, SiteSettings, TeamMember, Testimonial } from './types'

// Thin read helpers over the local Payload API — the getters every page shares. Reads use
// `overrideAccess: true` (server-side, trusted) and a `depth` high enough to populate the uploads,
// icons, Mux playback, and cross-references each view renders. Public read access is also set on
// the content collections, so this is belt-and-suspenders.

const payloadPromise = getPayload({ config })

export const getSiteSettings = async (): Promise<SiteSettings> => {
  const payload = await payloadPromise
  return (await payload.findGlobal({ slug: 'site-settings', depth: 2, overrideAccess: true })) as unknown as SiteSettings
}

export const getServices = async (): Promise<Service[]> => {
  const payload = await payloadPromise
  const { docs } = await payload.find({ collection: 'services', sort: 'order', depth: 1, limit: 20, overrideAccess: true })
  return docs as unknown as Service[]
}

export const getProjects = async (): Promise<Project[]> => {
  const payload = await payloadPromise
  // Featured first, then newest.
  const { docs } = await payload.find({ collection: 'projects', sort: ['-featured', '-year'], depth: 1, limit: 50, overrideAccess: true })
  return docs as unknown as Project[]
}

export const getFeaturedProject = async (): Promise<Project | undefined> => {
  const payload = await payloadPromise
  const { docs } = await payload.find({
    collection: 'projects',
    where: { featured: { equals: true } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as unknown as Project) ?? undefined
}

export const getProjectBySlug = async (slug: string): Promise<Project | undefined> => {
  const payload = await payloadPromise
  const { docs } = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, depth: 2, limit: 1, overrideAccess: true })
  return (docs[0] as unknown as Project) ?? undefined
}

export const getProjectSlugs = async (): Promise<string[]> => {
  const payload = await payloadPromise
  const { docs } = await payload.find({ collection: 'projects', depth: 0, limit: 100, overrideAccess: true })
  return (docs as { slug?: string | null }[]).flatMap((d) => (d.slug ? [d.slug] : []))
}

export const getTeam = async (): Promise<TeamMember[]> => {
  const payload = await payloadPromise
  const { docs } = await payload.find({ collection: 'team', sort: 'order', depth: 1, limit: 20, overrideAccess: true })
  return docs as unknown as TeamMember[]
}

export const getTestimonials = async (): Promise<Testimonial[]> => {
  const payload = await payloadPromise
  const { docs } = await payload.find({ collection: 'testimonials', depth: 1, limit: 20, overrideAccess: true })
  return docs as unknown as Testimonial[]
}
