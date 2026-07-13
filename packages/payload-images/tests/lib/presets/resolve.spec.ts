import { describe, expect, it } from 'vitest'

import { presetEntryName, presetQuery, resolvePreset } from '../../../src/lib/presets/resolve'
import type { PresetEntry, PresetTemplate } from '../../../src/types'

const templates: Record<string, PresetTemplate> = {
  og: { width: 1200, height: 630, fit: 'cover', quality: 80, format: 'jpeg' },
  square: { width: 600, aspectRatio: '1:1', fit: 'cover' },
}

describe('resolvePreset', () => {
  it('resolves a template reference against config (DRY)', () => {
    const entries: PresetEntry[] = [{ template: 'og' }]
    expect(resolvePreset(entries, templates, 'og')).toEqual(templates.og)
  })

  it('resolves a custom inline preset by its name', () => {
    const entries: PresetEntry[] = [{ name: 'hero', width: 1920, aspectRatio: '21:9', quality: 70 }]
    expect(resolvePreset(entries, templates, 'hero')).toMatchObject({ width: 1920, aspectRatio: '21:9', quality: 70 })
  })

  it('returns null for an unknown name, an inactive template, or a dangling template ref', () => {
    expect(resolvePreset([{ template: 'og' }], templates, 'square')).toBeNull() // not toggled on
    expect(resolvePreset([], templates, 'og')).toBeNull() // no entries
    expect(resolvePreset([{ template: 'gone' }], templates, 'gone')).toBeNull() // template deleted from config
    expect(resolvePreset(null, templates, 'og')).toBeNull()
  })

  it('names an entry by its template ref, else its custom name', () => {
    expect(presetEntryName({ template: 'og' })).toBe('og')
    expect(presetEntryName({ name: 'hero' })).toBe('hero')
    expect(presetEntryName({ template: 'og', name: 'ignored' })).toBe('og') // template wins
    expect(presetEntryName({})).toBeUndefined()
  })
})

describe('presetQuery', () => {
  it('maps a spec onto the endpoint query record (w/h/ar/fit/q/fmt)', () => {
    expect(presetQuery(templates.og!)).toEqual({ w: '1200', h: '630', fit: 'cover', q: '80', fmt: 'jpeg' })
    expect(presetQuery(templates.square!)).toEqual({ w: '600', ar: '1:1', fit: 'cover' })
  })

  it('returns null when a spec has no dimension anchor (unbuildable)', () => {
    expect(presetQuery({ fit: 'cover', quality: 80 })).toBeNull()
  })
})
