'use client'

import type React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import { useFormFields } from '@payloadcms/ui'

import { extractSvgContent, extractSvgProps } from '../../lib/extractSVG'

/**
 * Inlines a sanitized `svgString` as a real `<svg>` so the optimizer's
 * `currentColor` fills inherit the admin theme's text color — an `<img>` of the
 * stored file would paint black and vanish on the dark theme. Size wins over the
 * source's intrinsic width/height since it spreads after {@link extractSvgProps}.
 */
const InlineSvg: React.FC<{ svg: string; size: number }> = ({ svg, size }) => (
  <svg
    aria-hidden="true"
    {...extractSvgProps(svg)}
    width={size}
    height={size}
    style={{ display: 'block', color: 'currentColor' }}
    dangerouslySetInnerHTML={{ __html: extractSvgContent(svg) }}
  />
)

/** List-view Cell for the `svgString` column — a small themed preview of the icon. */
export const IconPreviewCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const svg = typeof cellData === 'string' ? cellData : ''
  return svg ? <InlineSvg svg={svg} size={28} /> : null
}

/** Edit-view UI field — the icon at a comfortable size on a theme-neutral rounded background. */
export const IconPreviewField: React.FC = () => {
  const svg = useFormFields(([fields]) => fields?.svgString?.value)
  if (typeof svg !== 'string' || !svg) return null
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: '1rem',
        marginBlockEnd: '1rem',
        borderRadius: 'var(--style-radius-m, 4px)',
        border: '1px solid var(--theme-elevation-150)',
        background: 'var(--theme-elevation-50)',
      }}
    >
      <InlineSvg svg={svg} size={64} />
    </div>
  )
}
