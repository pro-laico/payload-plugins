import { describe, expect, it } from 'vitest'

import { createFontCollection } from '../../src/collections/font'
import { fontUploadFields } from '../../src/fields/font'

const collection = createFontCollection({
  slug: 'font',
  originalSlug: 'fontOriginal',
  optimizedSlug: 'fontOptimized',
  charset: undefined,
  families: undefined,
})
const field = (name: string) => collection.fields.find((f) => 'name' in f && f.name === name)

const readLabel = async (doc: Record<string, unknown>) => {
  const optionLabel = field('optionLabel')
  const hook = optionLabel && 'hooks' in optionLabel ? optionLabel.hooks?.afterRead?.[0] : undefined
  return hook?.({ data: doc } as never)
}

describe('font collection — preferred family', () => {
  it('is optional, so a typeface can be uploaded before its role is decided', () => {
    const family = field('family')
    expect(family && 'required' in family ? family.required : undefined).toBeFalsy()
  })

  it('offers every typeface in every Font Set slot', () => {
    // Filtering slots by family would make a typeface that declared none unpickable everywhere —
    // the one thing a blank preference must not mean.
    const rows = fontUploadFields({ fontSlug: 'font', families: undefined })
    const slots = rows.flatMap((row) => row.fields)
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) expect('filterOptions' in slot ? slot.filterOptions : undefined).toBeUndefined()
  })
})

describe('font collection — option label', () => {
  it('appends the preferred family so a slot still shows what a typeface was meant for', async () => {
    expect(await readLabel({ title: 'Inter', family: 'sans' })).toBe('Inter (Sans)')
  })

  it('falls back to the bare name when no family is declared', async () => {
    expect(await readLabel({ title: 'Inter' })).toBe('Inter')
    expect(await readLabel({ title: 'Inter', family: '' })).toBe('Inter')
  })

  it('ignores a family that is not in the configured set', async () => {
    expect(await readLabel({ title: 'Inter', family: 'nonsense' })).toBe('Inter')
  })

  it('keeps its inputs selected and searchable despite being virtual', () => {
    // useAsTitle is virtual: it cannot back the list search, and its hook needs title + family
    // present however the document was queried.
    expect(collection.admin?.useAsTitle).toBe('optionLabel')
    expect(collection.admin?.listSearchableFields).toEqual(['title'])
    expect(collection.forceSelect).toMatchObject({ title: true, family: true })
  })
})
