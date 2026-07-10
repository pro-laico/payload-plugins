import type { Field, FieldHook } from 'payload'
import { describe, expect, it } from 'vitest'

import { VIRTUAL_URL_FIELDS, virtualUrlFields } from './virtualUrls'

const fieldByName = (name: string): Field & { hooks?: { afterRead?: FieldHook[] }; virtual?: boolean; admin?: { hidden?: boolean } } =>
  virtualUrlFields().find((f) => 'name' in f && f.name === name) as never

const read = (name: string, doc: Record<string, unknown>, serverURL?: string): unknown => {
  const hook = fieldByName(name).hooks?.afterRead?.[0] as FieldHook
  const req = serverURL ? { payload: { config: { serverURL } } } : {}
  return hook({ data: doc, req } as never)
}

const doc = { id: 'abc', width: 800, height: 600, filename: 'a.png', focalX: 50, focalY: 50 }

describe('virtualUrlFields', () => {
  it('exposes the virtual fields (URLs + version token), all virtual + hidden from the admin', () => {
    expect(VIRTUAL_URL_FIELDS).toEqual(['src', 'srcset', 'placeholderURL', 'thumbnailURL', 'variantVersion'])
    for (const name of VIRTUAL_URL_FIELDS) {
      const f = fieldByName(name)
      expect(f.virtual).toBe(true)
      expect(f.admin?.hidden).toBe(true)
    }
  })

  it('variantVersion matches the token the URL builders derive, and moves on focal/hotspot edits', () => {
    const v = read('variantVersion', doc) as string
    expect(typeof v).toBe('string')
    expect(read('src', doc)).toContain(`v=${v}`)
    expect(read('variantVersion', { ...doc, focalX: 70 })).not.toBe(v)
    expect(read('variantVersion', { ...doc, focalSize: 60 })).not.toBe(v)
  })

  it('builds relative URLs by default and absolute ones when serverURL is set', () => {
    expect(read('src', doc)).toMatch(/^\/api\/img\/abc\?/)
    expect(read('src', doc, 'https://site.com')).toMatch(/^https:\/\/site\.com\/api\/img\/abc\?/)
  })

  it('caps `src` at 1280px and emits a width-descriptor `srcset`', () => {
    expect(read('src', { ...doc, width: 4000 })).toContain('w=1280')
    expect(read('src', doc)).toContain('w=800') // smaller source isn't upscaled
    expect(read('srcset', doc)).toMatch(/ \d+w(,|$)/)
  })

  it('placeholder is a tiny low-quality variant; thumbnail is a 160px focal-cropped square', () => {
    expect(read('placeholderURL', doc)).toContain('w=32')
    expect(read('placeholderURL', doc)).toContain('q=40')
    const thumb = read('thumbnailURL', doc) as string
    expect(thumb).toContain('w=160')
    expect(thumb).toContain('h=160')
    expect(thumb).toContain('fit=cover')
  })

  it('returns null without an id or a filename (an unsaved / fileless doc)', () => {
    expect(read('src', { width: 800 })).toBeNull()
    expect(read('src', { id: 'x' })).toBeNull()
  })
})
