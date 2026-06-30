import { describe, expect, it } from 'vitest'
import { iconNameFromFilename } from './derive'

describe('iconNameFromFilename', () => {
  it('strips the directory and .svg extension', () => {
    expect(iconNameFromFilename('arrow-right.svg')).toBe('arrow-right')
    expect(iconNameFromFilename('brand/logo.svg')).toBe('logo')
    expect(iconNameFromFilename('a\\b\\check.SVG')).toBe('check')
  })

  it('tolerates a name with no extension', () => {
    expect(iconNameFromFilename('plain')).toBe('plain')
  })

  it('returns null for nullish input', () => {
    expect(iconNameFromFilename(null)).toBeNull()
    expect(iconNameFromFilename(undefined)).toBeNull()
  })
})
