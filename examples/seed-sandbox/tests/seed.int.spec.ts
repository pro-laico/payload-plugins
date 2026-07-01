import config from '@payload-config'
import { seed } from '@pro-laico/payload-seed'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postsSeed from '@/collections/Posts/seed'
import servicesSeed from '@/collections/Services/seed'
import siteSettingsSeed from '@/globals/SiteSettings/seed'
import mediaSeed from '@/seed/media'

// Integration test: boots the real example config against a temp SQLite DB and drives the
// REAL seed engine via the Local API — the automated analog of the admin SeedButton flow.

const seedOptions = { definitions: [mediaSeed, servicesSeed, postsSeed, siteSettingsSeed] }

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await (payload as unknown as { destroy?: () => Promise<void> }).destroy?.()
})

describe('seed engine (integration)', () => {
  it('seeds docs and resolves refs + assets', async () => {
    const result = await seed({ payload, options: seedOptions })

    // The order is *a* valid topological order (not a canonical one — it depends on input
    // ordering), so assert the dependency invariant: the referenced service is created
    // before the post that depends on it.
    expect(result.order).toContain('services:consulting')
    expect(result.order).toContain('posts:launch')
    expect(result.order.indexOf('services:consulting')).toBeLessThan(result.order.indexOf('posts:launch'))

    const services = await payload.find({ collection: 'services', limit: 0, depth: 0 })
    expect(services.totalDocs).toBe(2)
    expect(await payload.find({ collection: 'media', limit: 0 }).then((r) => r.totalDocs)).toBe(4)

    const consulting = services.docs.find((s) => s.slug === 'consulting')
    const implementation = services.docs.find((s) => s.slug === 'implementation')
    expect(consulting?.image).toBeTruthy() // ref('media', 'serviceA') resolved to a media doc id

    // Cross-file ref: the post points at the Consulting service created earlier.
    const post = (await payload.find({ collection: 'posts', depth: 0 })).docs[0]
    expect(post?.relatedService).toBe(consulting?.id)
    expect(post?.heroImage).toBeTruthy()

    // Global ref + asset resolved.
    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
    expect(settings.featuredService).toBe(implementation?.id)
    expect(settings.logo).toBeTruthy()
  })

  it('is idempotent — re-running clears and recreates without duplicating', async () => {
    await seed({ payload, options: seedOptions })
    expect(await payload.find({ collection: 'services', limit: 0 }).then((r) => r.totalDocs)).toBe(2)
    expect(await payload.find({ collection: 'posts', limit: 0 }).then((r) => r.totalDocs)).toBe(1)
    expect(await payload.find({ collection: 'media', limit: 0 }).then((r) => r.totalDocs)).toBe(4)
  })
})
