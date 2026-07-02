import { describe, expect, it } from 'vitest'
import { facesToStyles } from './specimen'

describe('facesToStyles', () => {
  it('expands a variable range into 100-stops with both ends included', () => {
    expect(facesToStyles([{ font: 1, weight: '100 900', style: 'normal', isVariable: true }])).toEqual([
      { style: 'normal', label: 'variable · 100–900', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    ])
    expect(facesToStyles([{ font: 1, weight: '250 620', style: 'normal', isVariable: true }])[0]?.weights).toEqual([
      250, 300, 400, 500, 600, 620,
    ])
  })

  it('lists exact weights for static faces, sorted and deduped', () => {
    const faces = [
      { font: 1, weight: '700', style: 'normal' as const, isVariable: false },
      { font: 1, weight: '400', style: 'normal' as const, isVariable: false },
      { font: 1, weight: '400', style: 'normal' as const, isVariable: false },
    ]
    expect(facesToStyles(faces)).toEqual([{ style: 'normal', label: '2 weights', weights: [400, 700] }])
  })

  it('splits upright and italic into separate styles, omitting absent ones', () => {
    const styles = facesToStyles([
      { font: 1, weight: '100 900', style: 'normal', isVariable: true },
      { font: 1, weight: '400', style: 'italic', isVariable: false },
    ])
    expect(styles.map((s) => [s.style, s.label])).toEqual([
      ['normal', 'variable · 100–900'],
      ['italic', '1 weight'],
    ])
  })

  it('returns nothing for no faces or unparseable weights', () => {
    expect(facesToStyles([])).toEqual([])
    expect(facesToStyles([{ font: 1, weight: 'bogus', style: 'normal', isVariable: false }])).toEqual([])
  })

  it('an ital-capable upright variable face contributes an italic style from the same file', () => {
    const styles = facesToStyles([{ font: 1, weight: '300 1000', style: 'normal', isVariable: true, italCapable: true }])
    expect(styles.map((s) => [s.style, s.label])).toEqual([
      ['normal', 'variable · 300–1000'],
      ['italic', 'variable · 300–1000'],
    ])
  })

  it('an explicit italic face suppresses ital-capable synthesis', () => {
    const styles = facesToStyles([
      { font: 1, weight: '100 900', style: 'normal', isVariable: true, italCapable: true },
      { font: 1, weight: '400', style: 'italic', isVariable: false },
    ])
    expect(styles.map((s) => [s.style, s.label])).toEqual([
      ['normal', 'variable · 100–900'],
      ['italic', '1 weight'],
    ])
  })
})
