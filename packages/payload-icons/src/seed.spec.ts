import { describe, expect, it } from 'vitest'
import { iconAssets } from './seed'

describe('iconAssets', () => {
  it('keys each spec by filename base and targets the icon collection by default', () => {
    expect(iconAssets(['arrow-right.svg', 'check.svg'])).toEqual({
      'arrow-right': { file: 'arrow-right.svg', collection: 'icon' },
      check: { file: 'check.svg', collection: 'icon' },
    })
  })

  it('strips directory segments from the key but keeps the file path', () => {
    expect(iconAssets(['brand/logo.svg'])).toEqual({ logo: { file: 'brand/logo.svg', collection: 'icon' } })
  })

  it('honors a renamed collection and per-doc data', () => {
    expect(iconAssets(['star.svg'], { collection: 'my-icon', data: { category: 'ui' } })).toEqual({
      star: { file: 'star.svg', collection: 'my-icon', data: { category: 'ui' } },
    })
  })

  it('tolerates a name with no extension', () => {
    expect(iconAssets(['plain'])).toEqual({ plain: { file: 'plain', collection: 'icon' } })
  })
})
