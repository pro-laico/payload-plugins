import type { Fit, Format } from './format'

export interface ParsedParams {
  w?: number
  h?: number
  fit: Fit
  q: number
  fmt: Format
}

export type ParseResult = { ok: true; params: ParsedParams } | { ok: false; error: string }

export type QuerySource = URLSearchParams | Record<string, string | null | undefined>
