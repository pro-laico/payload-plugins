import { describe, expect, it } from 'vitest'
import { extractSvgContent, extractSvgProps } from '../../src/lib/extractSVG'

describe('extractSvgProps', () => {
  it('parses attributes off the opening tag (xmlns dropped — meaningless inline)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0z"/></svg>'
    expect(extractSvgProps(svg)).toEqual({
      viewBox: '0 0 24 24',
      fill: 'currentColor',
    })
  })

  it('camelCases hyphenated presentation attrs for React (single quotes too), dropping xmlns namespaces', () => {
    const svg = `<svg xmlns:xlink='http://x' fill-rule="evenodd" stroke-width='2' shape-rendering="geometricPrecision"></svg>`
    expect(extractSvgProps(svg)).toEqual({ fillRule: 'evenodd', strokeWidth: '2', shapeRendering: 'geometricPrecision' })
  })

  it('keeps data-* / aria-* attributes verbatim (React expects those hyphenated)', () => {
    const svg = `<svg data-icon-name="check" aria-hidden="true" clip-rule="evenodd"></svg>`
    expect(extractSvgProps(svg)).toEqual({ 'data-icon-name': 'check', 'aria-hidden': 'true', clipRule: 'evenodd' })
  })

  it('drops root attrs React rejects or that mean nothing inline (xml:space, xmlns, version, enable-background)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xml:space="preserve" enable-background="new 0 0 100 100" viewBox="0 0 100 100" fill="currentColor"></svg>`
    expect(extractSvgProps(svg)).toEqual({ viewBox: '0 0 100 100', fill: 'currentColor' })
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
