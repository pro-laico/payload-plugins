import type React from 'react'

// ——— styles (Payload admin theme vars, matching the focalPreview card) ———
// name | width | height | ratio | fit | quality | format | link | control — shared by every row so cells align.
// Every column must be fixed or fr (no `auto`): each row is its own grid, and content-sized
// columns resolve per row, which knocks the rows out of alignment with the header.
export const COLS = 'minmax(120px, 2fr) 0.7fr 0.7fr 0.7fr 0.85fr 0.6fr 0.85fr 56px 140px'
export const card: React.CSSProperties = {
  marginBottom: '1rem',
  padding: '0.75rem',
  borderRadius: 'var(--style-radius-m, 4px)',
  border: '1px solid var(--theme-elevation-100)',
  background: 'var(--theme-elevation-50)',
}
export const note: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: '0.8rem', margin: 0 }
export const errText: React.CSSProperties = { color: 'var(--theme-error-500, #d33)', fontSize: '0.75rem', margin: '0.35rem 0 0' }
// overflowX auto + a min row width: on narrow (tablet/mobile) admin views the grid scrolls
// sideways instead of crushing its fr columns into overlapping slivers.
export const table: React.CSSProperties = {
  overflowX: 'auto',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-100)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
}
export const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLS,
  minWidth: 640,
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.4rem 0.6rem',
  borderTop: '1px solid var(--theme-elevation-100)',
}
export const headerRow: React.CSSProperties = {
  ...row,
  borderTop: 'none',
  padding: '0.35rem 0.6rem',
  background: 'var(--theme-elevation-50)',
}
export const headerCell: React.CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--theme-elevation-450)',
  whiteSpace: 'nowrap',
}
export const nameText: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--theme-elevation-800)',
  whiteSpace: 'nowrap',
}
export const variantName: React.CSSProperties = { ...nameText, fontWeight: 400 }
export const cellText: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '0.78rem',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--theme-elevation-700)',
  whiteSpace: 'nowrap',
}
export const emptyCell: React.CSSProperties = { ...cellText, color: 'var(--theme-elevation-300)' }
export const offStyle: React.CSSProperties = { opacity: 0.55 }
export const iconBtn: React.CSSProperties = {
  cursor: 'pointer',
  justifySelf: 'center',
  fontSize: '0.75rem',
  lineHeight: 1,
  padding: '0.45rem 0.55rem',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--theme-elevation-500)',
}
export const pagerBtn = (enabled: boolean): React.CSSProperties => ({
  ...iconBtn,
  cursor: enabled ? 'pointer' : 'default',
  opacity: enabled ? 1 : 0.35,
})
export const toggleTrack = (on: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  position: 'relative',
  justifySelf: 'center',
  width: 30,
  height: 17,
  padding: 0,
  flexShrink: 0,
  borderRadius: 999,
  border: '1px solid transparent',
  background: on ? 'var(--theme-success-500, var(--theme-elevation-800))' : 'var(--theme-elevation-200)',
  transition: 'background 0.15s ease',
})
export const toggleKnob = (on: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 1,
  left: on ? 14 : 1,
  width: 13,
  height: 13,
  borderRadius: '50%',
  background: 'var(--theme-elevation-0)',
  transition: 'left 0.15s ease',
})
// Longhand border (not the shorthand) — invalidInput swaps borderColor per-render, and React
// warns when a conditional longhand overrides a shorthand set on the same element.
export const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  fontSize: '0.78rem',
  padding: '0.3rem 0.4rem',
  background: 'var(--theme-elevation-50)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-s, 3px)',
  color: 'var(--theme-elevation-800)',
}
export const invalidInput: React.CSSProperties = { borderColor: 'var(--theme-error-500, #d33)' }
// Matches the draft inputs' height: same font size, same 1px border, same vertical padding.
export const addBtn: React.CSSProperties = {
  cursor: 'pointer',
  justifySelf: 'stretch',
  fontSize: '0.78rem',
  lineHeight: 1,
  // The admin root font-size is 13px; 1.6rem lands on the draft inputs' rendered height.
  height: '1.6rem',
  padding: 0,
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-800)',
  background: 'var(--theme-elevation-800)',
  color: 'var(--theme-elevation-0)',
}
export const purgeBtn = (busy: boolean): React.CSSProperties => ({
  cursor: busy ? 'default' : 'pointer',
  justifySelf: 'stretch',
  fontSize: '0.68rem',
  lineHeight: 1,
  padding: '0.3rem 0.4rem',
  whiteSpace: 'nowrap',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-200)',
  background: 'transparent',
  color: 'var(--theme-error-500, #d33)',
  opacity: busy ? 0.6 : 1,
})
export const prewarmBtn = (busy: boolean): React.CSSProperties => ({ ...purgeBtn(busy), color: 'var(--theme-elevation-700)' })
export const headerBtns: React.CSSProperties = { display: 'flex', gap: '0.35rem', justifySelf: 'stretch', justifyContent: 'center' }
export const limitWrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }

// ——— tick line (the width-axis strip above the table) ———
// Mid-500 hexes: the plugin has no categorical theme vars, and these read on both admin themes.
export const TICK_COLORS: Record<'preset' | 'generated' | 'planned', string> = { preset: '#8b5cf6', generated: '#10b981', planned: '#f59e0b' }
export const tickWrap: React.CSSProperties = { position: 'relative', margin: '0 0 0.75rem' }
export const tickCanvas: React.CSSProperties = {
  position: 'relative',
  height: 56,
  padding: '0 4px',
  borderRadius: 'var(--style-radius-s, 3px)',
  border: '1px solid var(--theme-elevation-100)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
}
export const tickShade: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  bottom: 4,
  right: 0,
  borderRadius: '0 var(--style-radius-s, 3px) var(--style-radius-s, 3px) 0',
  background: 'var(--theme-elevation-100)',
  opacity: 0.5,
}
export const tickCell = (active: boolean): React.CSSProperties => ({
  position: 'absolute',
  bottom: 0,
  width: 8,
  height: '100%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column-reverse',
  alignItems: 'center',
  paddingBottom: 8,
  cursor: 'crosshair',
  background: active ? 'var(--theme-elevation-100)' : 'transparent',
  borderRadius: 2,
})
export const tickSegment = (color: string, dim: boolean): React.CSSProperties => ({
  width: 2,
  height: 8,
  marginTop: 1,
  borderRadius: 999,
  background: color,
  opacity: dim ? 0.55 : 1,
})
export const tickHairline = (beyond: boolean): React.CSSProperties => ({
  width: 1,
  height: beyond ? 8 : 12,
  borderRadius: 999,
  background: beyond ? 'var(--theme-elevation-100)' : 'var(--theme-elevation-200)',
})
export const tickTooltip = (leftPct: number): React.CSSProperties => ({
  position: 'absolute',
  bottom: '100%',
  left: `${leftPct}%`,
  transform: 'translateX(-50%)',
  zIndex: 10,
  marginBottom: 8,
  minWidth: 220,
  maxWidth: 440,
  width: 'max-content',
  pointerEvents: 'none',
  padding: '0.6rem 0.7rem',
  borderRadius: 'var(--style-radius-m, 4px)',
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
  fontSize: '0.75rem',
  color: 'var(--theme-elevation-700)',
})
export const tickDot = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  marginRight: 6,
  borderRadius: '50%',
  background: color,
  verticalAlign: 'baseline',
})
export const tickAxisRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  margin: '0.2rem 0 0',
  fontSize: '0.65rem',
  color: 'var(--theme-elevation-500)',
}
export const tickLegend: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem 0.9rem',
  margin: '0.3rem 0 0',
  fontSize: '0.7rem',
  color: 'var(--theme-elevation-500)',
}
