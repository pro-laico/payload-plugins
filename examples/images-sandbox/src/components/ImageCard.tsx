import type { CSSProperties } from 'react'
import type { AspectRatio } from '@pro-laico/payload-images'
import { getImageUrl } from '@pro-laico/payload-images/utils/urls'

import { Image } from './Image'
import type { Image as ImageDoc } from '../payload-types'

/** The gallery card's read shape — what the list view selects off the images collection. */
export type ImageCardDoc = Pick<ImageDoc, 'id' | 'alt' | 'width' | 'height' | 'focalX' | 'focalY'>

const RATIOS: { label: string; ar?: AspectRatio }[] = [
  { label: 'natural' },
  { label: '16:9', ar: '16:9' },
  { label: '1:1', ar: '1:1' },
  { label: '9:16', ar: '9:16' },
]

const TILE_SIZES = '(max-width: 920px) 45vw, 200px'

const ratiosGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }
const ratioTile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)' }
const ratioLabel: CSSProperties = {
  display: 'block',
  padding: '6px 8px',
  fontSize: '0.72rem',
  color: 'var(--muted)',
  borderTop: '1px solid var(--border)',
}

/** One gallery card: the same image rendered at each demo ratio, plus its transform URL. */
export function ImageCard({ img }: { img: ImageCardDoc }) {
  return (
    <div className="shell-card">
      <div className="shell-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>{img.alt ?? '(no alt)'}</strong>
        <small className="shell-muted">
          {img.width}×{img.height} · focal {img.focalX ?? 50}%/{img.focalY ?? 50}%
        </small>
      </div>
      <div style={ratiosGrid}>
        {RATIOS.map(({ label, ar }) => (
          <div style={ratioTile} key={label}>
            <Image id={img.id} aspectRatio={ar} image={{ aspectRatio: ar }} sizes={TILE_SIZES} />
            <small style={ratioLabel}>{label}</small>
          </div>
        ))}
      </div>
      <p className="shell-muted" style={{ margin: '10px 0 0', fontSize: '0.78rem' }}>
        e.g. <code>{getImageUrl(img, { width: 600, aspectRatio: '1:1' })}</code>
      </p>
    </div>
  )
}
