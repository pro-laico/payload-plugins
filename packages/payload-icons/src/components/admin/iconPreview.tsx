'use client'

import type React from 'react'
import { useFormFields } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'

import { extractSvgContent, extractSvgProps } from '../../lib/extractSVG'

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

export const IconPreviewCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const svg = typeof cellData === 'string' ? cellData : ''
  return svg ? <InlineSvg svg={svg} size={28} /> : null
}

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
