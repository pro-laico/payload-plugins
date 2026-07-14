import { parseTransformParams } from '../transform/params'
import type { ProfileParts, RatioToken, TransformConstraints } from '../../types'

export interface RatioCandidate {
  token: RatioToken
  ratio: number
}

export const ratioToken = (ratio: number): RatioToken => `${Math.round(ratio * 1000) / 1000}`

export const canonicalProfileKey = (parts: ProfileParts): string => `${parts.ratio}|${parts.fit}|${parts.quality}|${parts.format}`

export interface ClassifyRatioArgs {
  w?: number
  h?: number
  sourceW?: number | null
  sourceH?: number | null
  candidates: RatioCandidate[]
  constraints: TransformConstraints
}

export const classifyRatio = ({ w, h, sourceW, sourceH, candidates, constraints }: ClassifyRatioArgs): RatioToken => {
  if (h == null) return 'none'
  if (w == null) return h > 0 ? ratioToken(1) : 'none'

  const natural: RatioCandidate[] = sourceW && sourceH && sourceH > 0 ? [{ token: 'natural', ratio: sourceW / sourceH }] : []
  for (const c of [...natural, ...candidates]) {
    if (!Number.isFinite(c.ratio) || c.ratio <= 0) continue
    const replay = parseTransformParams({ w: String(w), ar: String(c.ratio) }, constraints)
    if (replay.ok && replay.params.h === h) return c.token
  }
  return ratioToken(w / h)
}
