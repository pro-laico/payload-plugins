/** Pure parsing / validation for the on-demand transform endpoint — no Sharp, no Node APIs. */
import type { Fit, Format, OutputFormat, ParsedParams, ParseResult, QuerySource, TransformConstraints } from '../../types'

export const FITS: Fit[] = ['cover', 'contain', 'inside', 'outside', 'fill']
export const FORMATS: Format[] = ['auto', 'avif', 'webp', 'jpeg', 'png']

/** Default srcset width increment AND the default endpoint snap grid — sharing the value means
 *  well-behaved srcset widths pass through unchanged. */
export const DEFAULT_PIXEL_STEP = 50

export const DEFAULT_CONSTRAINTS: TransformConstraints = {
  maxDimension: 4096,
  qualityRange: [40, 95],
  defaultQuality: 75,
  formats: FORMATS,
  defaultFormat: 'auto',
  preferAvif: false,
  dimensionStep: DEFAULT_PIXEL_STEP,
  maxInputPixels: 100_000_000,
}

export const clampInt = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)))

/** Snap quality to the nearest multiple of 5, then clamp — bounds how many distinct variants
 *  a single (source, size, format) can spawn. */
export const bucketQuality = (q: number, [lo, hi]: [number, number]): number => clampInt(Math.round(q / 5) * 5, lo, hi)

/** Parse "16:9" | "16/9" | "1.78" → a number, or undefined when unparseable / non-positive. */
export const parseAspectRatio = (ar: number | string | null | undefined): number | undefined => {
  if (ar == null) return undefined
  if (typeof ar === 'number') return Number.isFinite(ar) && ar > 0 ? ar : undefined
  const s = ar.trim()
  const m = s.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const r = b > 0 ? a / b : 0
    return r > 0 ? r : undefined
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export const mimeForFormat = (fmt: OutputFormat): string => `image/${fmt}`
export const extForFormat = (fmt: OutputFormat): string => (fmt === 'jpeg' ? 'jpg' : fmt)

/** The concrete formats the plugin can encode/accept, in preference order. */
export const ENCODABLE_FORMATS: OutputFormat[] = ['avif', 'webp', 'jpeg', 'png']

/** Upload mime types accepted by the image collections — derived so they can't drift. */
export const IMAGE_MIME_TYPES: string[] = ENCODABLE_FORMATS.map(mimeForFormat)

/** Negotiate a concrete output format from the `Accept` header when `fmt=auto`, constrained to
 *  the configured `allowed` formats. Falls back jpeg → png → whatever's allowed. */
export const negotiateFormat = (accept: string | null | undefined, allowed?: Format[], preferAvif = false): OutputFormat => {
  const a = accept ?? ''
  const ok = (f: OutputFormat): boolean => !allowed || allowed.includes(f)
  if (preferAvif && a.includes('image/avif') && ok('avif')) return 'avif'
  if (a.includes('image/webp') && ok('webp')) return 'webp'
  if (ok('jpeg')) return 'jpeg'
  if (ok('png')) return 'png'
  if (ok('webp')) return 'webp'
  return ok('avif') ? 'avif' : 'jpeg'
}

const numeric = (s: string | undefined): number | undefined => {
  if (s == null || s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
const read = (q: QuerySource, key: string): string | undefined => {
  const v = q instanceof URLSearchParams ? q.get(key) : q[key]
  return v == null ? undefined : String(v)
}

/** Parse + validate the transform query params: width snaps to the grid, a missing dimension is
 *  derived from `ar`, quality clamps, unknown `fit`/`fmt` fall back. Requires width or height. */
export const parseTransformParams = (q: QuerySource, c: TransformConstraints): ParseResult => {
  const ar = parseAspectRatio(read(q, 'ar'))

  const wRaw = numeric(read(q, 'w'))
  const hRaw = numeric(read(q, 'h'))
  if (wRaw != null && wRaw <= 0) return { ok: false, error: 'invalid w' }
  if (hRaw != null && hRaw <= 0) return { ok: false, error: 'invalid h' }

  const cap = (n: number): number => clampInt(n, 1, c.maxDimension)
  let w = wRaw != null ? cap(Math.round(wRaw)) : undefined
  let h = hRaw != null ? cap(Math.round(hRaw)) : undefined

  if (ar) {
    if (w != null && h == null) h = cap(Math.round(w / ar))
    else if (h != null && w == null) w = cap(Math.round(h * ar))
  }

  if (w == null && h == null) return { ok: false, error: 'width or height required' }

  if (c.dimensionStep > 1) {
    const snap = (n: number | undefined): number | undefined =>
      n == null ? n : clampInt(Math.round(n / c.dimensionStep) * c.dimensionStep, Math.min(c.dimensionStep, c.maxDimension), c.maxDimension)
    w = snap(w)
    h = snap(h)
  }

  const fitRaw = read(q, 'fit')
  const fmtRaw = read(q, 'fmt')
  const qRaw = numeric(read(q, 'q'))
  const quality = qRaw == null ? c.defaultQuality : bucketQuality(qRaw, c.qualityRange)
  const fit: Fit = FITS.find((f) => f === fitRaw) ?? 'cover'
  const fmt: Format = c.formats.find((f) => f === fmtRaw) ?? c.defaultFormat

  return { ok: true, params: { w, h, fit, q: quality, fmt } }
}
