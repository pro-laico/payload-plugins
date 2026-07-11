/**
 * Canonicalizing an observed transform request into a render profile. The wrinkle: variant URLs
 * carry `w` + `h`, never `ar` (`buildVariantUrl` precomputes the height, even for the natural
 * ratio), so the declared ratio is recovered by EXACT REPLAY — re-derive `h` from each candidate
 * ratio through the endpoint's own `parseTransformParams` and accept an integer match. No epsilon
 * math, no drift: whatever the endpoint would serve is what classifies.
 */
import { parseTransformParams } from '../transform/params'
import type { ProfileParts, RatioToken, TransformConstraints } from '../../types'

/** A candidate declared ratio: the token it canonicalizes to + its numeric value. */
export interface RatioCandidate {
  token: RatioToken
  ratio: number
}

/** 3-decimal canonical token for a numeric ratio (`16/9` → `'1.778'`). */
export const ratioToken = (ratio: number): RatioToken => `${Math.round(ratio * 1000) / 1000}` as RatioToken

/** The stable registry key: `ratio|fit|quality|format`. */
export const canonicalProfileKey = (parts: ProfileParts): string => `${parts.ratio}|${parts.fit}|${parts.quality}|${parts.format}`

export interface ClassifyRatioArgs {
  /** The served (post-snap) width/height. */
  w?: number
  h?: number
  /** The source's intrinsic size, when known. */
  sourceW?: number | null
  sourceH?: number | null
  /** Candidate declared ratios, tried in priority order (natural is prepended automatically). */
  candidates: RatioCandidate[]
  constraints: TransformConstraints
}

/** Classify a served (w, h) pair to a ratio token — `'none'` for width-only, `'natural'`/a
 *  candidate token on exact replay match, else a canonical 3-dp fragment of the served ratio. */
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
