/**
 * The placeholder quality tiers — two formats, one knob:
 *
 *  - **BlurHash tiers** (`xs`…`xl`): spec-format hashes (component counts, NOT pixels — a
 *    blurhash is resolution-free). Tiny strings, croppable in coefficient space, decodable
 *    by any stock blurhash library.
 *  - **WebP tiers** (`xxl`, `x3`): stored micro-webp data URIs (the value is the stored
 *    full-frame width in px). Where blurhash math runs out of detail-per-byte, a real image
 *    wins — a blurred 32px webp beats a 24×24 hash at a fraction of the weight.
 *
 * The single source of truth shared by the upload hook (which stores one value per tier),
 * the `croppedBlurHash` virtual field (which serves the requested tier), and the admin
 * focal preview (which showcases them).
 */
export const BLURHASH_QUALITIES = {
  xs: [2, 2],
  sm: [4, 3],
  md: [6, 4],
  lg: [8, 6],
  xl: [9, 9],
} as const satisfies Record<string, readonly [number, number]>

/** Stored full-frame width (px) of each micro-webp placeholder tier. */
export const WEBP_QUALITIES = {
  xxl: 32,
  x3: 64,
} as const satisfies Record<string, number>

export type BlurhashQuality = keyof typeof BLURHASH_QUALITIES
export type WebpQuality = keyof typeof WEBP_QUALITIES
/** Any placeholder tier — blurhash (`xs`…`xl`) or micro-webp (`xxl`, `x3`). */
export type PlaceholderQuality = BlurhashQuality | WebpQuality

export const DEFAULT_BLURHASH_QUALITY: BlurhashQuality = 'sm'

export const isBlurhashQuality = (v: unknown): v is BlurhashQuality => typeof v === 'string' && v in BLURHASH_QUALITIES
export const isWebpQuality = (v: unknown): v is WebpQuality => typeof v === 'string' && v in WEBP_QUALITIES
export const isPlaceholderQuality = (v: unknown): v is PlaceholderQuality => isBlurhashQuality(v) || isWebpQuality(v)

const capitalize = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`

/** The stored field name for a blurhash tier (`blurHashXs` … `blurHashXl`). */
export const blurhashFieldName = (q: BlurhashQuality): string => `blurHash${capitalize(q)}`

/** The stored field name for a webp tier (`placeholderXxl`, `placeholderX3`). */
export const webpFieldName = (q: WebpQuality): string => `placeholder${capitalize(q)}`

/** The five stored blurhash field names, tier order. */
export const BLURHASH_FIELD_NAMES = (Object.keys(BLURHASH_QUALITIES) as BlurhashQuality[]).map(blurhashFieldName)

/** The stored webp placeholder field names, tier order. */
export const WEBP_FIELD_NAMES = (Object.keys(WEBP_QUALITIES) as WebpQuality[]).map(webpFieldName)

/** Every stored placeholder field name (blurhash tiers, then webp tiers). */
export const PLACEHOLDER_FIELD_NAMES = [...BLURHASH_FIELD_NAMES, ...WEBP_FIELD_NAMES]
