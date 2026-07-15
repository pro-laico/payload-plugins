import type { Fit, Format, OutputFormat, ParseResult, QuerySource, TransformConstraints } from '../../types'

export const FITS: Fit[] = ['cover', 'contain', 'inside', 'outside', 'fill']
export const FORMATS: Format[] = ['auto', 'avif', 'webp', 'jpeg', 'png']

export const DEFAULT_PIXEL_STEP = 50

// The default srcset ladder (next/image's deviceSizes): ~8 conventional rungs instead of a dense
// 50px grid, so a doc read emits a handful of srcset URLs and the stored variant space stays small.
// The 50px DEFAULT_PIXEL_STEP remains the endpoint's snap grid for freeform widths.
export const DEFAULT_WIDTH_LADDER: number[] = [640, 750, 828, 1080, 1200, 1920, 2048, 3840]

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

export const bucketQuality = (q: number, [lo, hi]: [number, number]): number => clampInt(Math.round(q / 5) * 5, lo, hi)

export const parseAspectRatio = (ar: number | string | null | undefined): number | undefined => {
  if (ar == null) return undefined
  if (typeof ar === 'number') return Number.isFinite(ar) && ar > 0 ? ar : undefined
  const s = ar.trim()
  const m = s.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/)
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

export const ENCODABLE_FORMATS: OutputFormat[] = ['avif', 'webp', 'jpeg', 'png']

export const IMAGE_MIME_TYPES: string[] = ENCODABLE_FORMATS.map(mimeForFormat)

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
    if (w != null && h == null) {
      let dh = Math.round(w / ar)
      if (dh > c.maxDimension) {
        dh = c.maxDimension
        w = cap(Math.round(dh * ar))
      }
      h = cap(dh)
    } else if (h != null && w == null) {
      let dw = Math.round(h * ar)
      if (dw > c.maxDimension) {
        dw = c.maxDimension
        h = cap(Math.round(dw / ar))
      }
      w = cap(dw)
    }
  }

  if (w == null && h == null) return { ok: false, error: 'width or height required' }

  if (c.dimensionStep > 1) {
    const ladder = c.widthLadder
    const snap = (n: number | undefined): number | undefined => {
      if (n == null) return n
      const grid = clampInt(Math.round(n / c.dimensionStep) * c.dimensionStep, Math.min(c.dimensionStep, c.maxDimension), c.maxDimension)
      if (!ladder?.length) return grid
      const rung = ladder.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best))
      return Math.abs(rung - n) < Math.abs(grid - n) ? rung : grid
    }
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
