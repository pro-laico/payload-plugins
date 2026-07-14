import { describe, expect, it } from 'vitest'

import { validatePresetEntries } from '../../../src/lib/presets/validateEntries'
import type { PresetSpec } from '../../../src/types'

const templates: Record<string, PresetSpec> = {
  og: { width: 1200, height: 630, fit: 'cover', quality: 80, format: 'jpeg' },
}

describe('validatePresetEntries', () => {
  it('accepts empty / missing values', () => {
    expect(validatePresetEntries(null, templates)).toBe(true)
    expect(validatePresetEntries(undefined, templates)).toBe(true)
    expect(validatePresetEntries([], templates)).toBe(true)
  })

  it('accepts a known template entry with no inline fields', () => {
    expect(validatePresetEntries([{ template: 'og' }], templates)).toBe(true)
  })

  it('rejects an unknown template (seed typo)', () => {
    const res = validatePresetEntries([{ template: 'go' }], templates)
    expect(res).toContain("unknown template 'go'")
  })

  it('accepts a fully specified custom entry', () => {
    expect(validatePresetEntries([{ name: 'social-card', width: 1200, height: 630, format: 'jpeg' }], templates)).toBe(true)
  })

  it('requires a format on custom entries', () => {
    const res = validatePresetEntries([{ name: 'card', width: 800 }], templates)
    expect(res).toContain('format is required')
  })

  it('requires geometry on custom entries', () => {
    const res = validatePresetEntries([{ name: 'card', format: 'webp' }], templates)
    expect(res).toContain('needs a width, height, or aspectRatio')
  })

  it('requires a name or template', () => {
    const res = validatePresetEntries([{ width: 800, format: 'webp' }], templates)
    expect(res).toContain('needs a name (or a template)')
  })

  it('rejects a URL-hostile name', () => {
    const res = validatePresetEntries([{ name: 'Social Card', width: 800, format: 'webp' }], templates)
    expect(res).toContain('lowercase letters/digits')
  })

  it('accepts aspectRatio geometry, including decimals', () => {
    expect(validatePresetEntries([{ name: 'wide', aspectRatio: '16:9', format: 'webp' }], templates)).toBe(true)
    expect(validatePresetEntries([{ name: 'photo', aspectRatio: '1.5:1', format: 'webp' }], templates)).toBe(true)
  })

  it('rejects malformed inline values', () => {
    const res = validatePresetEntries(
      [{ name: 'bad', width: 1.5, height: -2, aspectRatio: 'wide', fit: 'stretch', quality: 400, format: 'gif' }],
      templates,
    )
    expect(res).toContain('width must be a positive integer')
    expect(res).toContain('height must be a positive integer')
    expect(res).toContain('aspectRatio must look like 16:9')
    expect(res).toContain('fit must be one of')
    expect(res).toContain('quality must be an integer 1–100')
    expect(res).toContain('format is required')
  })

  it('rejects duplicate served names across template and custom entries', () => {
    const res = validatePresetEntries([{ template: 'og' }, { name: 'og', width: 800, format: 'webp' }], templates)
    expect(res).toContain('duplicate preset name')
  })

  it('labels problems with the row index and name', () => {
    const res = validatePresetEntries([{ template: 'og' }, { name: 'card', width: 800 }], templates)
    expect(res).toContain("presets[1] ('card')")
  })
})
