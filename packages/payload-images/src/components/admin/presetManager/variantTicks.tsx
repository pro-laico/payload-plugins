import type React from 'react'
import { useState } from 'react'

import { clampInt } from '../../../lib/transform/params'
import {
  TICK_COLORS,
  nameText,
  tickAxisRow,
  tickCanvas,
  tickCell,
  tickDot,
  tickHairline,
  tickLegend,
  tickSegment,
  tickShade,
  tickTooltip,
  tickWrap,
} from './styles'
import type { TickEntry, TickModel } from './tickModel'

// The width-axis strip: every reachable width as a hairline, every cached render as a colored
// tick (stacked when several renders share a stored width), planned prewarm targets dimmed,
// everything beyond the source width shaded. Hover a position for its renders.

const entryLine = (e: TickEntry): string =>
  `${e.width}${e.height != null ? `×${e.height}` : ''} · ${e.fit ?? 'cover'} · q${e.quality ?? '—'} · ${e.format ?? '—'}`

export const VariantTicks: React.FC<{ model: TickModel }> = ({ model }) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const pct = (w: number): number => (w / model.maxDim) * 100
  const hoveredStack = hovered != null ? (model.byWidth.get(hovered) ?? []) : []
  const beyond = (w: number): boolean => model.sourceWidth != null && w > model.sourceWidth

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only reset for an illustrative strip
    <div style={tickWrap} onMouseLeave={() => setHovered(null)}>
      {hovered != null && (
        <div style={tickTooltip(clampInt(pct(hovered), 18, 82))}>
          <div style={{ ...nameText, marginBottom: 4 }}>{hovered}px wide</div>
          {beyond(hovered) ? (
            <div>Beyond this source's width — never generated (no upscaling).</div>
          ) : hoveredStack.length === 0 ? (
            <div>Possible, not cached — generated on first request.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {hoveredStack.map((e) => (
                <li key={e.key} style={{ whiteSpace: 'nowrap', lineHeight: 1.5 }}>
                  <span style={tickDot(TICK_COLORS[e.kind])} />
                  {e.presetName && <span style={{ fontWeight: 600 }}>{e.presetName} · </span>}
                  {e.kind === 'planned' && <span style={{ fontWeight: 600 }}>planned · </span>}
                  {entryLine(e)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={tickCanvas}>
        <div style={{ position: 'relative', height: '100%' }}>
          {model.sourceWidth != null && <div style={{ ...tickShade, width: `${100 - pct(Math.min(model.sourceWidth, model.maxDim))}%` }} />}
          {model.positions.map((w) => {
            const stack = model.byWidth.get(w)
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: hover-only inspection of an illustrative mark
              <div key={w} style={{ ...tickCell(hovered === w), left: `${pct(w)}%` }} onMouseEnter={() => setHovered(w)}>
                {stack?.length ? (
                  stack.map((e) => <div key={e.key} style={tickSegment(TICK_COLORS[e.kind], e.kind === 'planned')} />)
                ) : (
                  <div style={tickHairline(beyond(w))} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={tickAxisRow}>
        <span>0px</span>
        <span>{model.maxDim}px (maxDimension)</span>
      </div>
      <div style={tickLegend}>
        <span>
          <span style={tickDot(TICK_COLORS.preset)} />
          presets
        </span>
        <span>
          <span style={tickDot(TICK_COLORS.generated)} />
          generated
        </span>
        <span>
          <span style={tickDot(TICK_COLORS.planned)} />
          planned
        </span>
        <span>
          <span style={tickDot('var(--theme-elevation-200)')} />
          possible, on-demand
        </span>
        <span>
          <span style={tickDot('var(--theme-elevation-100)')} />
          beyond the source
        </span>
        {model.overflow && <span>showing the first page of a larger set</span>}
      </div>
    </div>
  )
}
