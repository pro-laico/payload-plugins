/** The render-profile registry types: what the transform endpoint observes, canonicalized. */
import type { Fit, Format } from '../transform/format'

/** Canonical ratio token: `natural` (the source's own ratio), `none` (a width-only request),
 *  or a 3-decimal ratio string (`'1.778'`) for a declared ratio. */
export type RatioToken = 'natural' | 'none' | `${number}`

/** One observed render shape — the profile key's constituent parts. */
export interface ProfileParts {
  ratio: RatioToken
  fit: Fit
  /** Already bucketed (5s, clamped) — observations come from parsed params. */
  quality: number
  /** The REQUESTED format (usually `auto`); prewarm expands `auto` into concrete formats. */
  format: Format
}

/** Per-width observation counts: `{ '640': { n: 12, last: '2026-07-11T…' } }`. Capped; low-n entries evicted. */
export type WidthHistogram = Record<string, { n: number; last: string }>

/** A doc in the hidden `image-render-profiles` collection. */
export interface RenderProfileDoc {
  id: string | number
  profileKey: string
  ratio: string
  fit: string
  quality: number
  format: string
  hitCount?: number | null
  lastSeenAt?: string | null
  widths?: WidthHistogram | null
}
