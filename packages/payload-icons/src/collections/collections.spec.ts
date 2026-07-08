import { describe, expect, it } from 'vitest'

import { ICONS_REVALIDATE_TAG } from '../lib/revalidateTag'
import { Icon } from './Icon'
import { createIconRequestCollection } from './IconRequest'
import { createIconSetCollection } from './IconSet'

// The @pro-laico/payload-revalidate contract rides on `custom.revalidate` markers — data
// only, no import in either direction — so these assertions ARE the integration test:
// the write side (revalidatePlugin's hooks) and the read side (`getIconSvg`'s cacheTag)
// meet on the one shared tag these collections declare.
describe('custom.revalidate markers', () => {
  it('icon and iconSet carry the shared icons extraTag', () => {
    for (const collection of [Icon(), createIconSetCollection()]) {
      expect(collection.custom?.revalidate).toEqual({ extraTags: [ICONS_REVALIDATE_TAG] })
    }
  })

  it('iconRequest opts out entirely — diagnostics never bust anything', () => {
    expect(createIconRequestCollection().custom?.revalidate).toBe(false)
  })

  it('the shared tag is the stable string both halves hand-shake on', () => {
    expect(ICONS_REVALIDATE_TAG).toBe('payload-icons')
  })
})
