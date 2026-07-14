import { ratioToken } from './profileKey'
import { variantCacheKey } from '../transform/variantKey'
import { FITS, FORMATS, bucketQuality, parseAspectRatio, parseTransformParams } from '../transform/params'
import type { ComputeTargetsArgs, Fit, OutputFormat, PrewarmTarget, QuerySource, WidthHistogram } from '../../types'

export const DEFAULT_PREWARM_WIDTHS = [320, 640, 1024, 1600]
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

const isOutputFormat = (value: string): value is OutputFormat => FORMATS.some((f) => f === value)

const concreteFormat = (format: string): OutputFormat | undefined => (format !== 'auto' && isOutputFormat(format) ? format : undefined)

export const computePrewarmTargets = (args: ComputeTargetsArgs): PrewarmTarget[] => {
  const { source, seeds, formats, constraints, existingKeys, maxVariantsPerImage } = args
  const now = args.now ?? new Date()
  const sourceWidth = source.width && source.width > 0 ? Math.round(source.width) : undefined
  const widthCap = Math.min(sourceWidth ?? constraints.maxDimension, constraints.maxDimension)
  const natural = source.width && source.height && source.height > 0 ? source.width / source.height : undefined
  const q = constraints.defaultQuality

  const units: WarmUnit[] = [
    { ar: natural, fit: 'cover', quality: q, widths: [Math.min(sourceWidth ?? 1280, 1280)], formats },
    { ar: 1, fit: 'cover', quality: q, widths: [160], formats },
    { ar: natural, fit: 'cover', quality: 40, widths: [32], formats },
  ]

  for (const seed of seeds) {
    const ar = seed.aspectRatio != null ? parseAspectRatio(seed.aspectRatio) : natural
    const fit = asFit(seed.fit)
    const quality = bucketQuality(seed.quality ?? q, constraints.qualityRange)
    const token = seed.aspectRatio != null && ar != null ? ratioToken(ar) : 'natural'
    const match = args.profiles.find((p) => p.ratio === token && asFit(p.fit) === fit && p.quality === quality)
    const widths = seed.widths?.filter((w) => Number.isFinite(w) && w > 0) ?? topWidths(match?.widths) ?? DEFAULT_PREWARM_WIDTHS
    units.push({ ar, fit, quality, widths, formats })
  }

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
      widths: topWidths(p.widths) ?? DEFAULT_PREWARM_WIDTHS,
      formats: single ? [single] : formats,
    })
  }

  const targets: PrewarmTarget[] = []
  const seen = new Set<string>()
  for (const unit of units) {
    for (const rawWidth of unit.widths) {
      const w = Math.min(Math.round(rawWidth), widthCap)
      if (w <= 0) continue
      const query: QuerySource = { w: String(w), fit: unit.fit, q: String(unit.quality), ...(unit.ar ? { ar: String(unit.ar) } : {}) }
      const parsed = parseTransformParams(query, constraints)
      if (!parsed.ok) continue
      for (const format of unit.formats) {
        if (targets.length >= maxVariantsPerImage) return targets
        const key = variantCacheKey(source, parsed.params, format)
        if (seen.has(key) || existingKeys.has(key)) continue
        seen.add(key)
        targets.push({ params: parsed.params, format, key })
      }
    }
  }
  return targets
}
