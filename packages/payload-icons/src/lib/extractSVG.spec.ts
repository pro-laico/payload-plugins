import { describe, expect, it } from 'vitest'
import { extractSvgContent, extractSvgProps } from './extractSVG'

describe('extractSvgProps', () => {
  it('parses attributes off the opening tag', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0z"/></svg>'
    expect(extractSvgProps(svg)).toEqual({
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
    })
  })

  it('handles namespaced/hyphenated names and single quotes', () => {
    const svg = `<svg xmlns:xlink='http://x' fill-rule="evenodd" stroke-width='2'></svg>`
    expect(extractSvgProps(svg)).toEqual({ 'xmlns:xlink': 'http://x', 'fill-rule': 'evenodd', 'stroke-width': '2' })
  })

  it('returns {} when there is no <svg> tag', () => {
    expect(extractSvgProps('not an svg')).toEqual({})
  })
})

describe('extractSvgContent', () => {
  it('returns the inner markup of the <svg> wrapper', () => {
    expect(extractSvgContent('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')).toBe('<path d="M0 0"/>')
  })

  it('does not over-match across a nested <svg> (lazy)', () => {
    const inner = extractSvgContent('<svg><svg><rect/></svg></svg>')
    expect(inner).toBe('<svg><rect/>')
  })

  it('falls back to the input when there is no wrapper', () => {
    expect(extractSvgContent('<path d="M0 0"/>')).toBe('<path d="M0 0"/>')
  })
})
