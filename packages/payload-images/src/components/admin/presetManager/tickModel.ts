import { reachableWidths } from '../../../lib/prewarm/deriveWidths'
import type { TickConstraints } from '../../../types'
import type { AxisVariant, PlanRow, PresetMatch, VariantAxis } from './parsers'

// The pure data model behind the panel's width-axis tick line: every hoverable position on the
// 0→maxDimension axis, and the stacked renders (cached, preset-backed, planned) at each.

export type TickKind = 'preset' | 'generated' | 'planned'

export interface TickEntry {
  /** Stable render key — the variant/plan cacheKey when known, else a build-time synthetic. */
  key: string
  kind: TickKind
  width: number
  height?: number
  fit?: string
  quality?: number
  format?: string
  /** Set when kind === 'preset'. */
  presetName?: string
}

export interface TickModel {
  /** Every hoverable x-position, ascending: reachable widths ∪ actual variant widths ∪ plan widths. */
  positions: number[]
  /** Position → stacked entries; positions absent from the map are reachable-only hairlines. */
  byWidth: Map<number, TickEntry[]>
  maxDim: number
  sourceWidth?: number
  /** The axis fetch was capped — the strip shows the first page of a larger set. */
  overflow: boolean
}

const KIND_ORDER: Record<TickKind, number> = { preset: 0, generated: 1, planned: 2 }

export const buildTickModel = (input: {
  axis: VariantAxis
  presetMatches: Map<string, PresetMatch> | null
  plan: PlanRow[]
  constraints: TickConstraints
  sourceWidth?: number
}): TickModel => {
  const { axis, presetMatches, plan, constraints, sourceWidth } = input
  const maxDim = constraints.maxDimension

  const presetByKey = new Map<string, string>()
  for (const [name, match] of presetMatches ?? []) if (match.cacheKey) presetByKey.set(match.cacheKey, name)

  const entries: TickEntry[] = axis.docs.map((v: AxisVariant, i: number): TickEntry => {
    const presetName = v.cacheKey ? presetByKey.get(v.cacheKey) : undefined
    return {
      key: v.cacheKey ?? `v:${i}`,
      kind: presetName ? 'preset' : 'generated',
      width: Math.min(v.width, maxDim),
      height: v.height,
      fit: v.fit,
      quality: v.quality,
      format: v.format,
      ...(presetName ? { presetName } : {}),
    }
  })

  // Planned = in the prewarm plan but not cached yet. Dedupe by cacheKey, never by width — a plan
  // row whose render will clamp to a different stored width must still disappear once its key exists.
  const cachedKeys = new Set(axis.docs.flatMap((v) => (v.cacheKey ? [v.cacheKey] : [])))
  for (const row of plan) {
    if (typeof row.w !== 'number' || cachedKeys.has(row.cacheKey)) continue
    entries.push({
      key: row.cacheKey,
      kind: 'planned',
      width: Math.min(row.w, maxDim),
      height: row.h,
      fit: row.fit,
      quality: row.quality,
      format: row.format,
    })
  }

  const byWidth = new Map<number, TickEntry[]>()
  for (const e of entries) byWidth.set(e.width, [...(byWidth.get(e.width) ?? []), e])
  for (const stack of byWidth.values()) stack.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.quality ?? 0) - (b.quality ?? 0))

  const positions = [...new Set([...reachableWidths(constraints), ...byWidth.keys()])].sort((a, b) => a - b)
  return { positions, byWidth, maxDim, sourceWidth, overflow: axis.totalDocs > axis.docs.length }
}
