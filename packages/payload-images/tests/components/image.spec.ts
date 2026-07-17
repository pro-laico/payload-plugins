import type { CSSProperties, ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import { ResponsiveImage } from '../../src/components/image'
import { RESPONSIVE_IMAGE_SELECT } from '../../src/lib/renderIntent'
import type { ResponsiveImageDoc, ResponsiveImageProps } from '../../src/types'

// A doc as `imageFor(...).fetch()` returns it — the read declared 16:9, so the doc carries 16/9.
const doc: ResponsiveImageDoc = {
  id: '1',
  alt: 'a lighthouse',
  aspectRatio: 16 / 9,
  src: '/api/img/1?w=1280',
  srcset: '/api/img/1?w=640 640w',
}

// ResponsiveImage is a plain function component, so calling it returns the <img> to assert on.
const style = (props: Partial<ResponsiveImageProps>): CSSProperties => {
  const el = ResponsiveImage({ ...doc, ...props } as ResponsiveImageProps) as ReactElement
  return (el.props as { style: CSSProperties }).style
}

describe('aspectRatio comes from the doc', () => {
  // It used to have to be declared twice — once on the read so the crop is computed, once on the
  // component so the CSS box matches it — with a silent mismatch if they drifted.
  it('is projected by the read contract, so a fetched doc carries it', () => {
    expect(RESPONSIVE_IMAGE_SELECT).toHaveProperty('aspectRatio', true)
  })

  it('sets the CSS box from the spread doc, with nothing restated', () => {
    expect(style({}).aspectRatio).toBe(16 / 9)
  })

  it('still lets an explicit prop win', () => {
    expect(style({ aspectRatio: '1:1' }).aspectRatio).toBe(1)
  })

  it('leaves the box alone when the doc has no ratio', () => {
    expect(style({ aspectRatio: null }).aspectRatio).toBeUndefined()
  })

  it('is ignored under fill — the parent owns the box there', () => {
    const s = style({ fill: true })
    expect(s.aspectRatio).toBeUndefined()
    expect(s.position).toBe('absolute')
  })
})
