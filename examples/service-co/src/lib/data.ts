import config from '@payload-config'
import { getPayload } from 'payload'
import { createCacheHelpers } from '@pro-laico/payload-revalidate/cache'
import { type ImageRenderContext, RESPONSIVE_IMAGE_SELECT } from '@pro-laico/payload-images'

import type { IconDoc, MediaImage, MuxVideoDoc, Project, RelId, Service, SiteSettings, TeamMember, Testimonial } from '@/types'
import type { Project as ProjectDoc, Service as ServiceDoc, SiteSetting, Team, Testimonial as TestimonialDoc } from '@/payload-types'

import 'server-only'

// The ONE live Payload session (getPayload memoizes) — seeds the cache helpers and every
// getter below, so the session that fetches a doc is the session that tags it.
const db = getPayload({ config })
const { cacheDoc, cacheGlobal, cacheIds } = createCacheHelpers(db)

// Every getter reads at depth 0, so relationship values are ids at runtime — but the generated
// types stay depth-agnostic (`number | Doc`). These projections are the one honest boundary
// between the two: they narrow each doc to the app's slim contract types field by field.
function relId(v: RelId | { id: RelId }): RelId
function relId(v: RelId | { id: RelId } | null | undefined): RelId | null
function relId(v: RelId | { id: RelId } | null | undefined): RelId | null {
  return typeof v === 'object' && v !== null ? v.id : (v ?? null)
}

const toService = (doc: ServiceDoc): Service => ({
  id: doc.id,
  title: doc.title,
  slug: doc.slug,
  summary: doc.summary,
  order: doc.order,
  icon: relId(doc.icon),
  image: relId(doc.image),
})

const toProject = (doc: ProjectDoc): Project => ({
  id: doc.id,
  title: doc.title,
  slug: doc.slug,
  client: doc.client,
  location: doc.location,
  year: doc.year,
  summary: doc.summary,
  description: doc.description,
  featured: doc.featured,
  coverImage: relId(doc.coverImage),
  gallery: doc.gallery?.map((item) => ({ image: relId(item.image) })) ?? null,
  video: relId(doc.video),
  services: doc.services?.map((service) => relId(service)) ?? null,
})

const toTeamMember = (doc: Team): TeamMember => ({
  id: doc.id,
  name: doc.name,
  role: doc.role,
  bio: doc.bio,
  order: doc.order,
  photo: relId(doc.photo),
})

const toTestimonial = (doc: TestimonialDoc): Testimonial => ({
  id: doc.id,
  quote: doc.quote,
  author: doc.author,
  company: doc.company,
  project: relId(doc.project),
})

const toSiteSettings = (doc: SiteSetting): SiteSettings => ({
  companyName: doc.companyName,
  tagline: doc.tagline,
  description: doc.description,
  heroImage: relId(doc.heroImage),
  showreel: relId(doc.showreel),
  featuredProject: relId(doc.featuredProject),
  contact: doc.contact ?? null,
})

export const getSiteSettings = async (): Promise<SiteSettings> => {
  'use cache'
  const payload = await db
  const settings = toSiteSettings(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
  return cacheGlobal(settings, 'site-settings')
}

export const getServiceIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'services', sort: 'order', limit: 20, depth: 0, select: {} })
  await cacheIds(res, 'services', { list: 'ordered', label: 'service-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getService = async (id: string | number): Promise<Service | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({ collection: 'services', id, depth: 0, disableErrors: true })
  return cacheDoc(doc && toService(doc), 'services', { label: 'service-by-id' })
}

// Featured first, then newest — both determinants are declared on the `work` scope.
export const getProjectIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'projects', sort: ['-featured', '-year'], limit: 50, depth: 0, select: {} })
  await cacheIds(res, 'projects', { list: 'work', label: 'project-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getFeaturedProjectId = async (): Promise<string | number | null> => {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'projects', where: { featured: { equals: true } }, limit: 1, depth: 0, select: {} })
  await cacheIds(res, 'projects', { list: 'featured', label: 'featured-project-id' })
  return res.docs[0]?.id ?? null
}

export const getProject = async (id: string | number): Promise<Project | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({ collection: 'projects', id, depth: 0, disableErrors: true })
  return cacheDoc(doc && toProject(doc), 'projects', { label: 'project-by-id' })
}

// `as: slug` tags even a null miss, so the cached 404 purges the moment that slug is created.
export const getProjectBySlug = async (slug: string): Promise<Project | null> => {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  const doc = res.docs.at(0)
  return cacheDoc(doc ? toProject(doc) : null, 'projects', { as: slug, label: 'project-by-slug' })
}

export const getTeamIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'team', sort: 'order', limit: 20, depth: 0, select: {} })
  await cacheIds(res, 'team', { list: 'ordered', label: 'team-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getTeamMember = async (id: string | number): Promise<TeamMember | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({ collection: 'team', id, depth: 0, disableErrors: true })
  return cacheDoc(doc && toTeamMember(doc), 'team', { label: 'team-member-by-id' })
}

export const getTestimonialIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await db
  const res = await payload.find({ collection: 'testimonials', limit: 20, depth: 0, select: {} })
  await cacheIds(res, 'testimonials', { label: 'testimonial-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getTestimonial = async (id: string | number): Promise<Testimonial | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({ collection: 'testimonials', id, depth: 0, disableErrors: true })
  return cacheDoc(doc && toTestimonial(doc), 'testimonials', { label: 'testimonial-by-id' })
}

/** The cached variant of the image read the `<Image>` component does directly — the payload-images
 *  doc as an ordinary id-keyed entry, so an alt/focal edit busts `images:{id}` and exactly this
 *  entry re-materializes (with fresh `v=` tokens baked into the srcset, so the derived binary
 *  variants refresh too). The render context (`{ image, blur }`) declares what's being rendered,
 *  so `src`/`srcset`/`placeholder` arrive finished for it; 'use cache' keys on the args,
 *  giving each (id, render) its own entry — all tagged `images:{id}`, busted together. */
export const getImage = async (id: string | number, render?: ImageRenderContext): Promise<MediaImage | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({
    collection: 'images',
    id,
    depth: 0,
    select: RESPONSIVE_IMAGE_SELECT,
    context: { ...render },
    disableErrors: true,
  })
  return cacheDoc(doc, 'images', { label: 'image-by-id' })
}

/** A payload-icons doc by id — service cards render the related icon's `svgString` from this
 *  entry, so re-uploading a glyph busts `icon:{id}` and every card using it refreshes. */
export const getIcon = async (id: string | number): Promise<IconDoc | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({ collection: 'icon', id, depth: 0, disableErrors: true })
  return cacheDoc(doc, 'icon', { label: 'icon-by-id' })
}

/** A payload-mux doc by id — webhook writes go through `payload.update`, so a "processing"
 *  showreel/project video heals itself the moment the asset goes ready. */
export const getMuxVideo = async (id: string | number): Promise<MuxVideoDoc | null> => {
  'use cache'
  const payload = await db
  const doc = await payload.findByID({ collection: 'mux-video', id, depth: 0, disableErrors: true })
  return cacheDoc(doc, 'mux-video', { label: 'mux-video-by-id' })
}
