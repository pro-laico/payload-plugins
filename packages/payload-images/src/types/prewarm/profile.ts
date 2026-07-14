import type { Fit, Format } from '../transform/format'

export type RatioToken = 'natural' | 'none' | `${number}`

export interface ProfileParts {
  ratio: RatioToken
  fit: Fit
  quality: number
  format: Format
}

export type WidthHistogram = Record<string, { n: number; last: string }>

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
