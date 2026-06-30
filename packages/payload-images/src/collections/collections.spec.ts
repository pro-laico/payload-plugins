import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { createGeneratedImagesCollection } from './generatedImages'
import { createImagesCollection } from './images'

const byName = (fields: Field[], name: string) => fields.find((f) => 'name' in f && f.name === name)

describe('createImagesCollection', () => {
  it('is a plain upload: original untouched (no imageSizes, no re-encode), native focal', () => {
    const upload = createImagesCollection().upload as {
      imageSizes?: unknown[]
      focalPoint?: boolean
      formatOptions?: unknown
    }
    expect(upload).toBeTruthy()
    expect(upload.imageSizes).toBeUndefined() // on-demand only — never pre-generates sizes
    expect(upload.focalPoint).toBe(true)
    expect(upload.formatOptions).toBeUndefined() // stored as-uploaded
  })

  it('exposes a `variants` join onto the generated-images collection', () => {
    const join = byName(createImagesCollection().fields, 'variants')
    expect(join?.type).toBe('join')
    expect((join as { collection?: string }).collection).toBe('generated-images')
    expect((join as { on?: string }).on).toBe('source')
  })

  it('serves a focal-cropped admin thumbnail via /api/img (no full-res originals in the list)', () => {
    const upload = createImagesCollection().upload as { adminThumbnail?: (a: { doc: Record<string, unknown> }) => string | null }
    expect(typeof upload.adminThumbnail).toBe('function')
    expect(upload.adminThumbnail?.({ doc: { id: 'abc' } })).toBe('/api/img/abc?w=160&h=160&fit=cover&fmt=auto')
    expect(upload.adminThumbnail?.({ doc: {} })).toBeNull()
  })

  it('omits the admin thumbnail when adminThumbnail is false', () => {
    const upload = createImagesCollection({ adminThumbnail: false }).upload as { adminThumbnail?: unknown }
    expect(upload.adminThumbnail).toBeUndefined()
  })

  it('leans on Payload built-ins: upload-field previews, alt search, and editor descriptions', () => {
    const c = createImagesCollection()
    expect((c.upload as { displayPreview?: boolean }).displayPreview).toBe(true)
    expect(c.admin?.listSearchableFields).toContain('alt')
    expect(typeof c.admin?.description).toBe('string')
    const alt = byName(c.fields, 'alt')
    expect((alt as { admin?: { description?: string } }).admin?.description).toBeTruthy()
  })

  it('adds virtual URL fields by default (computed, for API consumers) and drops them when off', () => {
    const on = createImagesCollection()
    for (const name of ['src', 'srcset', 'placeholderURL', 'thumbnailURL']) {
      const f = byName(on.fields, name)
      expect((f as { virtual?: boolean }).virtual).toBe(true)
    }
    const off = createImagesCollection({ virtualFields: false })
    expect(byName(off.fields, 'src')).toBeUndefined()
  })

  it('populates renderable fields + virtual URLs by default, never the variants join', () => {
    const dp = createImagesCollection().defaultPopulate as Record<string, boolean>
    expect(dp.url).toBe(true)
    expect(dp.src).toBe(true)
    expect(dp.variants).toBeUndefined()
    // forceSelect keeps the virtual fields' inputs present even under `select`.
    expect((createImagesCollection().forceSelect as Record<string, boolean>).width).toBe(true)
  })

  it('localizes alt only when localizeAlt is set', () => {
    expect((byName(createImagesCollection({ localizeAlt: true }).fields, 'alt') as { localized?: boolean }).localized).toBe(true)
    expect((byName(createImagesCollection().fields, 'alt') as { localized?: boolean }).localized).toBe(false)
  })

  it('generates no placeholder at upload (no beforeChange hook); blurDataURL is virtual, not stored', () => {
    const c = createImagesCollection()
    expect(c.hooks?.beforeChange ?? []).toHaveLength(0)
    // The LQIP is generated on demand, never stored — the blurDataURL field is virtual.
    const blur = byName(c.fields, 'blurDataURL') as { virtual?: boolean } | undefined
    expect(blur?.virtual).toBe(true)
  })

  it('renders the focal + purge UI and the variants join only when focalUI is on', () => {
    const on = createImagesCollection({ focalUI: true })
    expect(byName(on.fields, 'focalPreview')).toBeTruthy()
    expect(byName(on.fields, 'purgeVariants')).toBeTruthy()
    expect(byName(on.fields, 'variants')).toBeTruthy()
    // focalUI:false → a clean upload (just alt + the file); no admin extras, no import map needed.
    const off = createImagesCollection({ focalUI: false })
    expect(byName(off.fields, 'focalPreview')).toBeUndefined()
    expect(byName(off.fields, 'purgeVariants')).toBeUndefined()
    expect(byName(off.fields, 'variants')).toBeUndefined()
  })
})

describe('createGeneratedImagesCollection', () => {
  it('is a hidden upload collection keyed by a unique cacheKey', () => {
    const c = createGeneratedImagesCollection()
    expect(c.admin?.hidden).toBe(true)
    expect(c.upload).toBeTruthy()
    const cacheKey = byName(c.fields, 'cacheKey')
    expect(cacheKey?.type).toBe('text')
    expect((cacheKey as { unique?: boolean }).unique).toBe(true)
    const source = byName(c.fields, 'source')
    expect(source?.type).toBe('relationship')
  })

  it('does not redefine the built-in upload width/height fields', () => {
    const c = createGeneratedImagesCollection()
    // width/height come from the upload built-ins; redefining them collides.
    const flat = c.fields.flatMap((f) => ('fields' in f ? (f.fields as Field[]) : [f]))
    expect(byName(flat, 'width')).toBeUndefined()
    expect(byName(flat, 'height')).toBeUndefined()
  })
})
