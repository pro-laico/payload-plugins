import 'server-only'
import { type ImageRenderContext, RESPONSIVE_IMAGE_SELECT } from '@pro-laico/payload-images'
import { cacheDoc, cacheGlobal, cacheIds, getPayloadClient } from '@pro-laico/payload-revalidate/cache'
import type { IconDoc, MediaImage, MuxVideoDoc, Project, Service, SiteSettings, TeamMember, Testimonial } from '@/types'

// The read side of @pro-laico/payload-revalidate — the atomic model:
//   • lists fetch IDS ONLY (`cacheIds`, `select: {}`) — their entries change on membership/order
//     events, never on content. Each declared scope (see src/plugins) names the fields that can
//     reorder it, so e.g. editing a service `order` busts services:list:ordered and nothing else.
//   • every doc renders through an id-keyed getter (`cacheDoc`, depth 0) — ITS entry is the only
//     thing a content edit re-materializes, at every usage site at once.
//   • references stay ids; the page awaits the referenced doc's own getter (getImage, getIcon,
//     getMuxVideo), so an image alt edit busts images:{id} and exactly one entry refreshes.
// Reads keep `overrideAccess: true` (server-side, trusted; public read access is also set on the
// content collections, so this is belt-and-suspenders). Watch it all live at /dev/revalidate.

export const getSiteSettings = async (): Promise<SiteSettings> => {
  'use cache'
  const payload = await getPayloadClient()
  const settings = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as unknown as SiteSettings
  return cacheGlobal(settings, 'site-settings')
}

export const getServiceIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'services', sort: 'order', limit: 20, depth: 0, select: {}, overrideAccess: true })
  await cacheIds(res, 'services', { list: 'ordered', label: 'service-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getService = async (id: string | number): Promise<Service | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({ collection: 'services', id, depth: 0, disableErrors: true, overrideAccess: true })) as Service | null
  return cacheDoc(doc, 'services', { label: 'service-by-id' })
}

// Featured first, then newest — both determinants are declared on the `work` scope.
export const getProjectIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'projects',
    sort: ['-featured', '-year'],
    limit: 50,
    depth: 0,
    select: {},
    overrideAccess: true,
  })
  await cacheIds(res, 'projects', { list: 'work', label: 'project-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getFeaturedProjectId = async (): Promise<string | number | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'projects',
    where: { featured: { equals: true } },
    limit: 1,
    depth: 0,
    select: {},
    overrideAccess: true,
  })
  await cacheIds(res, 'projects', { list: 'featured', label: 'featured-project-id' })
  return res.docs[0]?.id ?? null
}

export const getProject = async (id: string | number): Promise<Project | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({ collection: 'projects', id, depth: 0, disableErrors: true, overrideAccess: true })) as Project | null
  return cacheDoc(doc, 'projects', { label: 'project-by-id' })
}

// `as: slug` tags even a null miss, so the cached 404 purges the moment that slug is created.
export const getProjectBySlug = async (slug: string): Promise<Project | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  return cacheDoc((res.docs[0] as unknown as Project | undefined) ?? null, 'projects', { as: slug, label: 'project-by-slug' })
}

export const getTeamIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'team', sort: 'order', limit: 20, depth: 0, select: {}, overrideAccess: true })
  await cacheIds(res, 'team', { list: 'ordered', label: 'team-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getTeamMember = async (id: string | number): Promise<TeamMember | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({ collection: 'team', id, depth: 0, disableErrors: true, overrideAccess: true })) as TeamMember | null
  return cacheDoc(doc, 'team', { label: 'team-member-by-id' })
}

export const getTestimonialIds = async (): Promise<(string | number)[]> => {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'testimonials', limit: 20, depth: 0, select: {}, overrideAccess: true })
  await cacheIds(res, 'testimonials', { label: 'testimonial-ids' })
  return res.docs.map((doc) => doc.id)
}

export const getTestimonial = async (id: string | number): Promise<Testimonial | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({
    collection: 'testimonials',
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
  })) as Testimonial | null
  return cacheDoc(doc, 'testimonials', { label: 'testimonial-by-id' })
}

/** The cached variant of the image read the `<Image>` component does directly — the payload-images
 *  doc as an ordinary id-keyed entry, so an alt/focal edit busts `images:{id}` and exactly this
 *  entry re-materializes (with fresh `v=` tokens baked into the srcset, so the derived binary
 *  variants refresh too). The render context (`{ image, blur }`) declares what's being rendered,
 *  so `src`/`srcset`/`placeholder` arrive finished for it; 'use cache' keys on the args,
 *  giving each (id, render) its own entry — all tagged `images:{id}`, busted together. */
export const getImage = async (id: string | number, render?: ImageRenderContext): Promise<MediaImage | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({
    collection: 'images',
    id,
    depth: 0,
    select: RESPONSIVE_IMAGE_SELECT,
    context: { ...render },
    disableErrors: true,
    overrideAccess: true,
  })) as MediaImage | null
  return cacheDoc(doc, 'images', { label: 'image-by-id' })
}

/** A payload-icons doc by id — service cards render the related icon's `svgString` from this
 *  entry, so re-uploading a glyph busts `icon:{id}` and every card using it refreshes. */
export const getIcon = async (id: string | number): Promise<IconDoc | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({ collection: 'icon', id, depth: 0, disableErrors: true, overrideAccess: true })) as IconDoc | null
  return cacheDoc(doc, 'icon', { label: 'icon-by-id' })
}

/** A payload-mux doc by id — webhook writes go through `payload.update`, so a "processing"
 *  showreel/project video heals itself the moment the asset goes ready. */
export const getMuxVideo = async (id: string | number): Promise<MuxVideoDoc | null> => {
  'use cache'
  const payload = await getPayloadClient()
  const doc = (await payload.findByID({
    collection: 'mux-video',
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
  })) as MuxVideoDoc | null
  return cacheDoc(doc, 'mux-video', { label: 'mux-video-by-id' })
}
