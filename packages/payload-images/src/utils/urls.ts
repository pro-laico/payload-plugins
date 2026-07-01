/**
 * Isomorphic URL builders for the on-demand transform endpoint. NO Node / Sharp / server imports —
 * safe to bundle into client components. `buildVariantUrl` / `buildSrcset` produce same-origin
 * relative URLs by default (pass `baseUrl` for absolute); `getImageUrl` — the one-off/shareable
 * helper — instead defaults `baseUrl` to `process.env.NEXT_PUBLIC_SERVER_URL` (a Next build-time
 * constant, inlined in client bundles) so OG/email URLs come out absolute with no extra wiring.
 */
import { DEFAULT_PIXEL_STEP, type Fit, type Format, parseAspectRatio } from '../transform/params'

export { DEFAULT_PIXEL_STEP }

/**
 * Default base for transform URLs: `/api` + the endpoint's fixed `/img` path. Override
 * `path` only if your Payload API route or Next.js basePath differs from the default.
 */
export const DEFAULT_TRANSFORM_API_PATH = '/api/img'

export interface BuildUrlOptions {
  fit?: Fit
  quality?: number
  format?: Format
  /** Render aspect ratio (`16/9` | `"16:9"`); derives `h` from each width. */
  aspectRatio?: number | string
  /** Prefix for absolute URLs (e.g. `https://site.com`). Default '' (same-origin). */
  baseUrl?: string
  /** Endpoint base. Default `/api/img` ({@link DEFAULT_TRANSFORM_API_PATH}); override only for a custom API route / basePath. */
  path?: string
  /**
   * Cache-busting version token appended as `v=`. Derive it from the source doc with
   * {@link deriveVersion} so replacing the file or moving the focal point yields a new
   * URL — busting immutable browser/CDN caches (the server ignores `v`, reading focal
   * from the doc; it exists only to make the immutable URL honest).
   */
  version?: string
}

/** Source-identity fields that determine the rendered pixels (independent of size/quality). */
export interface VersionSource {
  filename?: string | null
  focalX?: number | null
  focalY?: number | null
}

const fnv1a = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * A short, stable version token from the source-identity fields that change the
 * rendered pixels (filename + focal point) — the same inputs the server folds into
 * the variant cache key. Returns undefined when no identity is available (a bare id),
 * in which case URLs carry no `v` — so pass a populated doc to get cache-correct
 * busting on file replace / focal edits.
 */
export const deriveVersion = (src?: VersionSource | null): string | undefined => {
  if (!src) return undefined
  const { filename, focalX, focalY } = src
  if (filename == null && focalX == null && focalY == null) return undefined
  return fnv1a(`${filename ?? ''}|${focalX ?? ''}|${focalY ?? ''}`)
}

/** A bare id, or a populated image doc (so the version token + a default width can be read off it). */
export type ImageResource = string | number | ({ id: string | number; width?: number | null } & VersionSource) | null | undefined

export interface GetImageUrlOptions extends BuildUrlOptions {
  /** Output width. Falls back to a populated doc's intrinsic width, else 1280. */
  width?: number
  /** Prefix for absolute URLs. Defaults to `NEXT_PUBLIC_SERVER_URL`; pass `''` for a relative URL. */
  baseUrl?: string
}

/**
 * One transform URL for an image, taking the id OR a populated doc directly: it resolves the
 * id, picks a sensible default width, and (for a doc) folds in the cache-busting version
 * automatically — so you don't re-implement the resolve-and-`deriveVersion` dance every time
 * you need a raw URL (OG tags, CSS backgrounds, emails). Returns null when there's no id.
 * For a responsive `<img>`, prefer `<ResponsiveImage>` / {@link buildSrcset}.
 *
 * Because these URLs are usually for external/shareable contexts (OG, email), `baseUrl` defaults
 * to `process.env.NEXT_PUBLIC_SERVER_URL` so the result is absolute with no extra wiring. Pass an
 * explicit `baseUrl` to override, or `baseUrl: ''` to force a relative same-origin URL.
 */
export const getImageUrl = (resource: ImageResource, o: GetImageUrlOptions = {}): string | null => {
  if (resource == null) return null
  const doc = typeof resource === 'object' ? resource : undefined
  const id = doc ? (doc.id == null ? '' : String(doc.id)) : String(resource)
  if (!id) return null
  const width = o.width ?? doc?.width ?? 1280
  return buildVariantUrl(id, width, {
    ...o,
    baseUrl: o.baseUrl ?? (process.env.NEXT_PUBLIC_SERVER_URL || undefined),
    version: o.version ?? deriveVersion(doc),
  })
}

export const buildVariantUrl = (id: string, width: number, o: BuildUrlOptions = {}): string => {
  const base = o.baseUrl ?? ''
  const apiPath = o.path ?? DEFAULT_TRANSFORM_API_PATH
  const ar = parseAspectRatio(o.aspectRatio)
  const params = new URLSearchParams()
  params.set('w', String(Math.round(width)))
  if (ar) params.set('h', String(Math.round(width / ar)))
  params.set('fit', o.fit ?? 'cover')
  params.set('q', String(o.quality ?? 75))
  params.set('fmt', o.format ?? 'auto')
  if (o.version) params.set('v', o.version)
  return `${base}${apiPath}/${encodeURIComponent(id)}?${params.toString()}`
}

/**
 * The widths for a srcset. Two modes via `pixelStep`:
 *
 *  - a **number** (the step): every multiple of it up to the source's intrinsic width,
 *    then the exact source width as the final candidate (so the srcset always tops out
 *    at the true native resolution, not the largest step multiple below it). With no
 *    source width, steps up to `maxWidth`.
 *  - an **array** (an explicit, possibly non-linear ladder à la a curated width list):
 *    the ladder values that fall below the source width, then the exact source width on
 *    top. With no source width, the ladder is used as-is (its author-chosen cap is kept).
 *
 * Either way no width exceeds the source (no upscaling) or `maxWidth`. The entry count is
 * bounded by the size ceiling: a bigger step / a shorter ladder / a smaller source yields
 * fewer widths (and so fewer cached variants).
 */
export const stepWidths = (sourceWidth?: number, pixelStep: number | number[] = DEFAULT_PIXEL_STEP, maxWidth = 4096): number[] => {
  const known = sourceWidth && sourceWidth > 0 ? Math.min(maxWidth, Math.round(sourceWidth)) : undefined

  if (Array.isArray(pixelStep)) {
    const ladder = [
      ...new Set(
        pixelStep
          .filter((w) => Number.isFinite(w) && w > 0)
          .map((w) => Math.round(w))
          .filter((w) => w <= maxWidth),
      ),
    ].sort((a, b) => a - b)
    if (known == null) return ladder.length ? ladder : [maxWidth]
    const widths = ladder.filter((w) => w < known)
    widths.push(known) // exact source width as the top candidate
    return widths
  }

  const step = pixelStep > 0 ? pixelStep : DEFAULT_PIXEL_STEP
  const top = known ?? maxWidth
  const widths: number[] = []
  for (let w = step; w < top; w += step) widths.push(w)
  widths.push(top)
  return widths
}

export interface BuildSrcsetOptions extends BuildUrlOptions {
  /**
   * The srcset widths. A number is the step increment (default 50; bigger = fewer widths).
   * An array is an explicit, curated ladder of widths (e.g. `[200, 450, 750, 1200, 2000]`)
   * — non-linear, denser where it matters, fewer entries than a fine linear step.
   */
  pixelStep?: number | number[]
  /** The source image's intrinsic width — caps the srcset (no upscaling). */
  sourceWidth?: number
  /** Hard ceiling. Default 4096. */
  maxWidth?: number
  /** Width used for the plain `src` fallback. Defaults to min(top, 1280). */
  defaultWidth?: number
}

export interface BuildSrcsetResult {
  srcset: string
  src: string
}

/** Build a responsive `srcset` (pixelStep multiples up to the source width) + a default `src`. */
export const buildSrcset = (id: string, o: BuildSrcsetOptions = {}): BuildSrcsetResult => {
  const widths = stepWidths(o.sourceWidth, o.pixelStep, o.maxWidth)
  const srcset = widths.map((w) => `${buildVariantUrl(id, w, o)} ${w}w`).join(', ')
  const top = widths[widths.length - 1] ?? o.maxWidth ?? 4096
  const src = buildVariantUrl(id, o.defaultWidth ?? Math.min(top, 1280), o)
  return { srcset, src }
}

export type { Fit, Format }
