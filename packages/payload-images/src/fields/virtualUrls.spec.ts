import type { Field, FieldHook } from 'payload'
import { describe, expect, it } from 'vitest'

import { VIRTUAL_URL_FIELDS, virtualUrlFields } from './virtualUrls'

const fieldByName = (name: string): Field & { hooks?: { afterRead?: FieldHook[] }; virtual?: boolean; admin?: { hidden?: boolean } } =>
  virtualUrlFields().find((f) => 'name' in f && f.name === name) as never

const read = (name: string, doc: Record<string, unknown>, opts: { serverURL?: string; intent?: Record<string, unknown> } = {}): unknown => {
  const hook = fieldByName(name).hooks?.afterRead?.[0] as FieldHook
  const req = {
    ...(opts.serverURL ? { payload: { config: { serverURL: opts.serverURL } } } : {}),
    ...(opts.intent ? { context: { image: opts.intent } } : {}),
  }
  return hook({ data: doc, req } as never)
}

const doc = { id: 'abc', width: 800, height: 600, filename: 'a.png', focalX: 50, focalY: 50 }

describe('virtualUrlFields', () => {
  it('exposes the virtual fields (URLs + ratio + version token), all virtual + hidden from the admin', () => {
    expect(VIRTUAL_URL_FIELDS).toEqual(['src', 'srcset', 'aspectRatio', 'placeholderURL', 'thumbnailURL', 'variantVersion'])
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
    expect(read('src', doc, { serverURL: 'https://site.com' })).toMatch(/^https:\/\/site\.com\/api\/img\/abc\?/)
  })

  it('honors the declared render intent (context.image): srcset geometry + params, and aspectRatio echoes it', () => {
    const srcset = read('srcset', doc, { intent: { aspectRatio: '16/9', quality: 80, fit: 'contain', format: 'webp' } }) as string
    expect(srcset).toContain('w=800&h=450') // 16/9 h derived per width, not the natural 4/3
    expect(srcset).toContain('q=80')
    expect(srcset).toContain('fit=contain')
    expect(srcset).toContain('fmt=webp')
    expect(read('aspectRatio', doc, { intent: { aspectRatio: '16/9' } })).toBeCloseTo(16 / 9)
    expect(read('aspectRatio', doc)).toBeCloseTo(800 / 600) // undeclared → natural
    // Garbage intent values are ignored, not trusted.
    expect(read('srcset', doc, { intent: { fit: 'zoom', format: 'gif' } })).toContain('fit=cover')
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
