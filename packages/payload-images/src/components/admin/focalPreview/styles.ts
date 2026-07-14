import type React from 'react'

export const note: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: '0.8rem', margin: 0 }

export const chipStyle: React.CSSProperties = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.72rem',
  borderRadius: 999,
  background: 'var(--theme-elevation-100)',
  color: 'var(--theme-elevation-650)',
  whiteSpace: 'nowrap',
}

export const selectStyle: React.CSSProperties = {
  padding: '0.2rem 0.45rem',
  fontSize: '0.75rem',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  color: 'var(--theme-elevation-800)',
  cursor: 'pointer',
}

export const handleStyle: React.CSSProperties = {
  position: 'absolute',
  width: 12,
  height: 12,
  background: 'var(--theme-elevation-0, #fff)',
  border: '2px solid var(--theme-success-500, #22c55e)',
  borderRadius: 2,
  boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
  zIndex: 3,
}

export const tileLabelStyle: React.CSSProperties = {
  position: 'absolute',
  left: 4,
  bottom: 4,
  padding: '0.05rem 0.35rem',
  fontSize: '0.65rem',
  borderRadius: 3,
  background: 'rgba(0,0,0,0.55)',
  color: 'rgba(255,255,255,0.9)',
  pointerEvents: 'none',
  zIndex: 2,
}
