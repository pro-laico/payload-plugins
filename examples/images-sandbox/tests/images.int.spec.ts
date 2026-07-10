import { seed } from '@pro-laico/payload-seed'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '../src/payload.config'
import images from '../src/seed/images'
import pages from '../src/seed/pages'

const seedOptions = { definitions: [images, pages], assetsDir: 'seed-assets' }

/** Build a minimal PayloadRequest the transform endpoint understands (id + query + Accept). */
const makeReq = (payload: Payload, id: string, query: string, accept?: string): PayloadRequest =>
  ({
    payload,
    routeParams: { id },
    searchParams: new URLSearchParams(query),
    headers: new Headers(accept ? { accept } : {}),
  }) as unknown as PayloadRequest

const getHandler = (payload: Payload, method: string, path: string) => {
  const ep = payload.config.endpoints.find((e) => e.method === method && e.path === path)
  if (!ep) throw new Error(`endpoint ${method} ${path} not registered`)
  return ep.handler
}

const countVariants = async (payload: Payload, sourceId: string | number): Promise<number> => {
  const r = await payload.find({ collection: 'generated-images', where: { source: { equals: sourceId } }, limit: 100, overrideAccess: true })
  return r.totalDocs
}

/** The endpoint persists the variant AFTER responding (fire-and-forget), so poll for it. */
const waitForVariants = async (payload: Payload, sourceId: string | number, min = 1, tries = 40): Promise<number> => {
  for (let i = 0; i < tries; i++) {
    const n = await countVariants(payload, sourceId)
    if (n >= min) return n
    await new Promise((res) => setTimeout(res, 50))
  }
  return countVariants(payload, sourceId)
}

describe('payload-images wiring', () => {
  let payload: Payload
  let sourceId: string

  beforeAll(async () => {
    process.env.PAYLOAD_SECRET = 'test-secret'
    payload = await getPayload({ config })
    // The sqlite adapter bound DATABASE_URI at config import (the shared `test` file), so
    // clear seeded collections for an idempotent run. db.deleteMany bypasses hooks.
    const req = await createLocalReq({}, payload)
    await payload.db.deleteMany({ collection: 'generated-images', req, where: {} })
    await payload.db.deleteMany({ collection: 'images', req, where: {} })
    await payload.db.deleteMany({ collection: 'pages', req, where: {} })

    // A gradient, not a solid: a solid image has all-zero blurhash AC coefficients, which would
    // make "cropping changes the hash" untestable (a crop of a solid IS the solid).
    const gw = 1200
    const gh = 800
    const raw = Buffer.alloc(gw * gh * 3)
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const o = (y * gw + x) * 3
        raw[o] = Math.round((x / gw) * 255) // red ramps left→right
        raw[o + 1] = 140
        raw[o + 2] = Math.round((y / gh) * 255) // blue ramps top→bottom
      }
    const png = await sharp(raw, { raw: { width: gw, height: gh, channels: 3 } })
      .png()
      .toBuffer()
    const doc = await payload.create({
      collection: 'images',
      data: { alt: 'green', focalX: 40, focalY: 60 },
      file: { data: png, mimetype: 'image/png', name: 'green.png', size: png.byteLength },
      overrideAccess: true,
    })
    sourceId = String(doc.id)
  }, 60_000)

  afterAll(async () => {
    await payload?.db?.destroy?.()
  })

  it('registers the images + generated-images collections (under an Assets group)', () => {
    const slugs = payload.config.collections.map((c) => c.slug)
    expect(slugs).toEqual(expect.arrayContaining(['images', 'generated-images']))
    const images = payload.config.collections.find((c) => c.slug === 'images')
    const fieldNames = (images?.fields ?? []).flatMap((f) => ('name' in f && f.name ? [f.name] : []))
    expect(fieldNames).toEqual(expect.arrayContaining(['alt', 'variants']))
  })

  it('registers the transform, purge, and seed endpoints', () => {
    const paths = payload.config.endpoints.map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(expect.arrayContaining(['get /img/:id', 'post /img/purge/:id', 'post /seed']))
  })

  it('exposes images as an upload-relationship target', () => {
    const pages = payload.config.collections.find((c) => c.slug === 'pages')
    const hero = (pages?.fields ?? []).find((f) => 'name' in f && f.name === 'heroImage')
    expect(hero).toMatchObject({ type: 'upload', relationTo: 'images' })
  })

  it('400s without a dimension and 404s for an unknown source', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    expect((await handler(makeReq(payload, sourceId, ''))).status).toBe(400)
    expect((await handler(makeReq(payload, 'does-not-exist', 'w=320'))).status).toBe(404)
  })

  it('generates a webp variant on miss (streams bytes + caches a doc) and serves it on hit', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')

    const miss = await handler(makeReq(payload, sourceId, 'w=600&h=600&fit=cover&fmt=webp'))
    expect(miss.status).toBe(200)
    expect(miss.headers.get('Content-Type')).toBe('image/webp')
    // Default images collection is publicly readable → public + edge-cacheable.
    expect(miss.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    const meta = await sharp(Buffer.from(await miss.arrayBuffer())).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(600)
    expect(meta.height).toBe(600)

    expect(await waitForVariants(payload, sourceId, 1)).toBe(1)

    // A second identical request is a cache hit — no new variant created.
    const hit = await handler(makeReq(payload, sourceId, 'w=600&h=600&fit=cover&fmt=webp'))
    expect(hit.status).toBe(200)
    await new Promise((res) => setTimeout(res, 150))
    expect(await countVariants(payload, sourceId)).toBe(1)
  })

  it('negotiates fmt=auto to webp by default and sets Vary', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, sourceId, 'w=320&h=320&fmt=auto', 'image/avif,image/webp,*/*'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Vary')).toBe('Accept')
  })

  it('snaps the requested width to the dimension grid (anti-DoS bound on the variant space)', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, sourceId, 'w=730&fmt=jpeg'))
    expect(res.status).toBe(200)
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(750) // 730 snapped up to the nearest 50px grid point
  })

  it('stores the placeholder tiers at upload, and croppedBlurHash serves the read a finished placeholder', async () => {
    // The seed uploads ran the beforeChange generator — every tier is a non-empty string.
    const doc = (await payload.findByID({ collection: 'images', id: sourceId, overrideAccess: true })) as unknown as Record<string, unknown>
    for (const f of ['blurHashXs', 'blurHashSm', 'blurHashMd', 'blurHashLg', 'blurHashXl']) {
      expect(typeof doc[f], f).toBe('string')
      expect((doc[f] as string).length).toBeGreaterThan(5)
    }
    // Tier component counts encode into the string length: 4 + 2·cx·cy chars.
    expect((doc.blurHashSm as string).length).toBe(4 + 2 * 4 * 3)
    expect((doc.blurHashXl as string).length).toBe(4 + 2 * 9 * 9)
    // The micro-webp tiers store full-frame data URIs.
    for (const f of ['placeholderXxl', 'placeholderX3']) expect(doc[f], f).toMatch(/^data:image\/webp;base64,/)

    // The same analysis stamps the palette and alpha flags (RGB gradient: opaque, no alpha).
    const palette = doc.palette as { dominant?: { background?: string; foreground?: string; population?: number } } | null
    expect(palette?.dominant?.background).toMatch(/^#[0-9a-f]{6}$/)
    expect(['#000000', '#ffffff']).toContain(palette?.dominant?.foreground)
    expect(doc.hasAlpha).toBe(false)
    expect(doc.isOpaque).toBe(true)

    // The fixture was created with an explicit focal (40/60) — the saliency suggestion must not override it.
    expect(doc.focalX).toBe(40)
    expect(doc.focalY).toBe(60)

    // No request info → croppedBlurHash defaults to the raw sm tier hash, uncropped (the
    // cheap path for reads that never render a placeholder).
    expect(doc.croppedBlurHash).toBe(doc.blurHashSm)

    // Declare the render (req.context.blurhash) → a FINISHED placeholder data URI, cropped
    // to that ratio in the field hook — no variant rows, nothing written.
    const before = await countVariants(payload, sourceId)
    const cropped = (await payload.findByID({
      collection: 'images',
      id: sourceId,
      overrideAccess: true,
      context: { blurhash: { ar: '16/9' } },
    })) as { croppedBlurHash?: string | null }
    expect(cropped.croppedBlurHash).toMatch(/^data:image\/png;base64,/)
    expect(await countVariants(payload, sourceId)).toBe(before) // read-side crop touches no files

    // A webp tier serves the stored micro-webp, cropped per read.
    const webp = (await payload.findByID({
      collection: 'images',
      id: sourceId,
      overrideAccess: true,
      context: { blurhash: { ar: '16/9', quality: 'xxl' } },
    })) as { croppedBlurHash?: string | null }
    expect(webp.croppedBlurHash).toMatch(/^data:image\/webp;base64,/)
    expect(webp.croppedBlurHash).not.toBe(doc.placeholderXxl) // cropped, not the stored full frame

    // format: 'hash' keeps the raw-hash contract for stock blurhash decoders: the cropped
    // hash string — same shape as the stored tier, different coefficients.
    const rawHash = (await payload.findByID({
      collection: 'images',
      id: sourceId,
      overrideAccess: true,
      context: { blurhash: { ar: '16/9', format: 'hash' } },
    })) as { croppedBlurHash?: string | null }
    expect((rawHash.croppedBlurHash as string).length).toBe((doc.blurHashSm as string).length)
    expect(rawHash.croppedBlurHash).not.toBe(doc.blurHashSm)

    // Quality tier selection rides the same request object (no ar → full-frame PNG of that tier).
    const xl = (await payload.findByID({
      collection: 'images',
      id: sourceId,
      overrideAccess: true,
      context: { blurhash: { quality: 'xl', format: 'hash' } },
    })) as { croppedBlurHash?: string | null }
    expect(xl.croppedBlurHash).toBe(doc.blurHashXl)
  })

  it('suggests a saliency focal on create when the editor picked none (attention crop)', async () => {
    // A bright saturated blob in the top-right of a dark field — unambiguous saliency target.
    const w = 640
    const h = 640
    const raw = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 3
        const inBlob = (x - 480) ** 2 + (y - 160) ** 2 < 80 ** 2
        raw[o] = inBlob ? 255 : 18
        raw[o + 1] = inBlob ? 90 : 20
        raw[o + 2] = inBlob ? 40 : 22
      }
    const png = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer()
    const doc = (await payload.create({
      collection: 'images',
      data: { alt: 'saliency blob' }, // no focal → the hook may suggest one
      file: { data: png, mimetype: 'image/png', name: 'blob.png', size: png.byteLength },
      overrideAccess: true,
    })) as { id: string | number; focalX?: number | null; focalY?: number | null }

    // The blob sits at (75%, 25%) — the suggestion should land in that quadrant, never the 50/50 default.
    expect(doc.focalX).toBeGreaterThan(55)
    expect(doc.focalY).toBeLessThan(45)
    await payload.delete({ collection: 'images', id: doc.id, overrideAccess: true })
  })

  it('<ResponsiveImage> renders a single <img> (Shape B) painting the croppedBlurHash it was handed', async () => {
    const { ResponsiveImage } = await import('@pro-laico/payload-images/components/image')
    // The consumption pattern: the READ declares the render, the component stays passive.
    const doc = await payload.findByID({
      collection: 'images',
      id: sourceId,
      depth: 0,
      overrideAccess: true,
      context: { blurhash: { ar: '16/9' } },
    })

    // A Server Component is just an async function → call it and inspect the returned element.
    const el = (await ResponsiveImage({ image: doc, aspectRatio: '16/9', config } as never)) as {
      type: string
      props: { srcSet?: string; loading?: string; style?: { objectFit?: string; backgroundImage?: string } }
    }
    expect(el.type).toBe('img') // Shape B: one element, no wrapper
    expect(el.props.srcSet).toContain('/api/img/')
    expect(el.props.loading).toBe('lazy')
    expect(el.props.style?.objectFit).toBe('cover')
    // The blurhash is rendered to a tiny inline PNG at the render's aspect ratio.
    expect(el.props.style?.backgroundImage).toMatch(/^url\(data:image\/png;base64,/)
    const b64 = (el.props.style?.backgroundImage ?? '').match(/base64,([^)]+)\)/)?.[1]
    const meta = await sharp(Buffer.from(b64 as string, 'base64')).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(32)
    expect(meta.height).toBe(18) // round(32 / (16/9))

    // placeholder={false} skips the paint even though the doc carries a hash.
    const off = (await ResponsiveImage({ image: doc, aspectRatio: '1/1', config, placeholder: false } as never)) as {
      props: { style?: { backgroundImage?: string } }
    }
    expect(off.props.style?.backgroundImage).toBeUndefined()

    // Fully passive: a doc without croppedBlurHash renders without a placeholder — the
    // component never fetches or generates one.
    const bare = (await ResponsiveImage({ image: { id: sourceId, width: 1200, height: 800 }, aspectRatio: '1/1', config } as never)) as {
      props: { style?: { backgroundImage?: string } }
    }
    expect(bare.props.style?.backgroundImage).toBeUndefined()
  })

  it('getImageUrl builds an absolute, focal-cropped OG URL that the endpoint serves (the generateMetadata pattern)', async () => {
    const { getImageUrl } = await import('@pro-laico/payload-images/utils/urls')
    const doc = await payload.findByID({ collection: 'images', id: sourceId, depth: 0, overrideAccess: true })

    // What you'd drop into `openGraph.images[].url` in a Next generateMetadata.
    const ogUrl = getImageUrl(doc, { width: 1200, aspectRatio: '1200/630', baseUrl: 'https://cdn.example.com' }) as string
    expect(ogUrl.startsWith('https://cdn.example.com/api/img/')).toBe(true) // absolute — social crawlers need it
    expect(ogUrl).toContain('w=1200')
    expect(ogUrl).toContain('h=630')
    expect(ogUrl).toContain('v=') // cache-bust token (filename + focal)

    // And it actually resolves to an image (height snaps to the 50px anti-DoS grid → 650).
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, sourceId, ogUrl.split('?')[1], 'image/webp'))
    expect(res.status).toBe(200)
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(650)
  })

  it('purges a source’s variants and cascades on delete', async () => {
    const handler = getHandler(payload, 'get', '/img/:id')
    // Ensure at least one variant exists.
    await handler(makeReq(payload, sourceId, 'w=500&h=500&fit=cover&fmt=webp'))
    await waitForVariants(payload, sourceId, 1)
    expect(await countVariants(payload, sourceId)).toBeGreaterThan(0)

    // Deleting the source removes its variants via the beforeDelete hook.
    await payload.delete({ collection: 'images', id: sourceId, overrideAccess: true })
    expect(await countVariants(payload, sourceId)).toBe(0)
  })

  it('seeds the sample images + page via @pro-laico/payload-seed (native asset flow + focal points)', async () => {
    // The endpoint persists variants AFTER responding (fire-and-forget under vitest, no
    // request scope for next's after()) — let any in-flight persist land before the seed
    // clears `images`, or its insert hits a freshly-deleted source FK.
    let settled = await countVariants(payload, sourceId)
    for (let i = 0; i < 20; i++) {
      await new Promise((res) => setTimeout(res, 100))
      const now = await countVariants(payload, sourceId)
      if (now === settled) break
      settled = now
    }

    // The same run the admin "Seed" button / the frontend demo trigger: uploads the three
    // sample photos into `images` (carrying focal points), then a page referencing one.
    const result = await seed({ payload, options: seedOptions })
    expect(result.created.images).toBe(3)
    expect(result.created.pages).toBe(1)

    const imgs = await payload.find({ collection: 'images', limit: 50, overrideAccess: true, sort: 'createdAt' })
    expect(imgs.totalDocs).toBe(3)
    const lighthouse = imgs.docs.find((d) => d.alt === 'Landscape sample') as
      | { id: string | number; focalX?: number; focalY?: number; src?: string; srcset?: string; placeholderURL?: string }
      | undefined
    expect(lighthouse?.focalX).toBe(78)
    expect(lighthouse?.focalY).toBe(32)

    // Virtual URL fields are computed on read and ride along in the API response (absolute, since
    // the sandbox sets serverURL).
    expect(lighthouse?.src).toContain('/api/img/')
    expect(lighthouse?.srcset).toContain('/api/img/')
    expect(lighthouse?.placeholderURL).toContain('w=32')

    // The page resolved its `ref('images', 'lighthouse')` token to the seeded image doc's id.
    const page = (await payload.find({ collection: 'pages', depth: 0, overrideAccess: true })).docs[0] as
      | { heroImage?: string | number }
      | undefined
    expect(page?.heroImage).toBe(lighthouse?.id)

    // And the transform endpoint renders a seeded image, focal-cropped, end to end.
    const handler = getHandler(payload, 'get', '/img/:id')
    const res = await handler(makeReq(payload, String(lighthouse?.id), 'w=400&h=400&fit=cover&fmt=webp'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(400)
  })
})
