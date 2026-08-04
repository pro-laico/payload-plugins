import { ratioToken } from './profileKey'
import { deriveStrategyWidths } from './deriveWidths'
import { variantCacheKey } from '../transform/variantKey'
import { ENCODABLE_FORMATS, FITS, bucketQuality, parseAspectRatio, parseTransformParams } from '../transform/params'
import type { ComputeTargetsArgs, ComputeTargetsResult, Fit, OutputFormat, PrewarmTarget, QuerySource, WidthHistogram } from '../../types'

const MAX_WIDTHS_PER_PROFILE = 4
const PROFILE_TTL_DAYS = 30

interface WarmUnit {
  ar?: number
  fit: Fit
  quality: number
  widths: number[]
  formats: OutputFormat[]
}

const topWidths = (hist: WidthHistogram | null | undefined): number[] | undefined => {
  if (!hist) return undefined
  const entries = Object.entries(hist)
    .map(([w, v]) => ({ w: Number(w), n: v?.n ?? 0 }))
    .filter((e) => Number.isFinite(e.w) && e.w > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_WIDTHS_PER_PROFILE)
    .map((e) => e.w)
  return entries.length ? entries : undefined
}

const asFit = (fit: string | undefined): Fit => FITS.find((f) => f === fit) ?? 'cover'

// Even spread under budget pressure: when the remaining budget can't fit a unit's widths, keep an
// evenly distributed subset — half the budget warms every other width, a third every third — so
// coverage thins uniformly across the range (the fallback bridges the gaps) instead of losing the
// whole large end. Both extremes survive whenever two or more slots do.
const spreadWidths = (widths: number[], slots: number): number[] => {
  const n = widths.length
  if (slots <= 0) return []
  if (n <= slots) return widths
  if (slots === 1) return widths.slice(-1)
  const picked = new Set<number>()
  for (let i = 0; i < slots; i++) picked.add(Math.round((i * (n - 1)) / (slots - 1)))
  return widths.filter((_, i) => picked.has(i))
}

const concreteFormat = (format: string): OutputFormat | undefined => ENCODABLE_FORMATS.find((f) => f === format)

export const computePrewarmTargets = (args: ComputeTargetsArgs): ComputeTargetsResult => {
  const { source, strategy, formats, constraints, existingKeys, maxVariantsPerImage } = args
  const now = args.now ?? new Date()
  const sourceWidth = source.width && source.width > 0 ? Math.round(source.width) : undefined
  const widthCap = Math.min(sourceWidth ?? constraints.maxDimension, constraints.maxDimension)
  const natural = source.width && source.height && source.height > 0 ? source.width / source.height : undefined
  const q = constraints.defaultQuality
  // The strategy's width axis — the ladder unit's widths and the fallback for seeds/profiles
  // that arrive without their own.
  const ladderWidths = deriveStrategyWidths(strategy.widths, sourceWidth, constraints)

  // Unit order is the budget's priority order: built-ins → seeds → learned → derived ladder.
  const units: WarmUnit[] = strategy.builtIns
    ? [
        // The `src` render: `buildVariantUrl` emits no `h` when the read declared no ratio, so
        // this unit must not carry one — an `ar` here would derive an `h` and key a variant the
        // `src` URL never requests.
        { fit: 'cover', quality: q, widths: [Math.min(sourceWidth ?? 1280, 1280)], formats },
        { ar: 1, fit: 'cover', quality: q, widths: [160], formats },
        { ar: natural, fit: 'cover', quality: 40, widths: [32], formats },
      ]
    : []

  for (const seed of strategy.seeds) {
    const ar = seed.aspectRatio != null ? parseAspectRatio(seed.aspectRatio) : natural
    const fit = asFit(seed.fit)
    const quality = bucketQuality(seed.quality ?? q, constraints.qualityRange)
    const token = seed.aspectRatio != null && ar != null ? ratioToken(ar) : 'natural'
    const match = args.profiles.find((p) => p.ratio === token && asFit(p.fit) === fit && p.quality === quality)
    const widths = seed.widths?.filter((w) => Number.isFinite(w) && w > 0) ?? topWidths(match?.widths) ?? ladderWidths
    units.push({ ar, fit, quality, widths, formats })
  }

  if (strategy.learned) {
    const cutoff = now.getTime() - PROFILE_TTL_DAYS * 86_400_000
    const live = args.profiles
      .filter((p) => p.lastSeenAt == null || new Date(p.lastSeenAt).getTime() >= cutoff)
      .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
    for (const p of live) {
      const ar = p.ratio === 'natural' ? natural : p.ratio === 'none' ? undefined : (parseAspectRatio(p.ratio) ?? undefined)
      const single = concreteFormat(p.format)
      units.push({
        ar,
        fit: asFit(p.fit),
        quality: bucketQuality(p.quality, constraints.qualityRange),
        widths: topWidths(p.widths) ?? ladderWidths,
        formats: single ? [single] : formats,
      })
    }
  }

  const targets: PrewarmTarget[] = []
  const seen = new Set<string>()
  let truncated = false
  for (const unit of units) {
    const slots = Math.floor((maxVariantsPerImage - targets.length) / unit.formats.length)
    const widths = spreadWidths(unit.widths, slots)
    if (widths.length < unit.widths.length) truncated = true
    for (const rawWidth of widths) {
      const w = Math.min(Math.round(rawWidth), widthCap)
      if (w <= 0) continue
      const query: QuerySource = { w: String(w), fit: unit.fit, q: String(unit.quality), ...(unit.ar ? { ar: String(unit.ar) } : {}) }
      const parsed = parseTransformParams(query, constraints)
      if (!parsed.ok) continue
      for (const format of unit.formats) {
        if (targets.length >= maxVariantsPerImage) return { targets, truncated: true }
        const key = variantCacheKey(source, parsed.params, format)
        if (seen.has(key) || existingKeys.has(key)) continue
        seen.add(key)
        targets.push({ params: parsed.params, format, key })
      }
    }
  }
  return { targets, truncated }
}
