export const BLURHASH_TIERS = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export const WEBP_TIERS = ['xxl', 'x3'] as const

export type BlurhashQuality = (typeof BLURHASH_TIERS)[number]
export type WebpQuality = (typeof WEBP_TIERS)[number]
export type PlaceholderQuality = BlurhashQuality | WebpQuality
export type PlaceholderFormat = 'uri' | 'hash'

export const BLURHASH_QUALITIES = {
  xs: [2, 2],
  sm: [4, 3],
  md: [6, 4],
  lg: [8, 6],
  xl: [9, 9],
} as const satisfies Record<BlurhashQuality, readonly [number, number]>

export const WEBP_QUALITIES = { xxl: 32, x3: 64 } as const satisfies Record<WebpQuality, number>

export const DEFAULT_BLURHASH_QUALITY: BlurhashQuality = 'sm'

export const isBlurhashQuality = (v: unknown): v is BlurhashQuality => typeof v === 'string' && v in BLURHASH_QUALITIES
export const isWebpQuality = (v: unknown): v is WebpQuality => typeof v === 'string' && v in WEBP_QUALITIES
export const isPlaceholderQuality = (v: unknown): v is PlaceholderQuality => isBlurhashQuality(v) || isWebpQuality(v)
export const isPlaceholderFormat = (v: unknown): v is PlaceholderFormat => v === 'uri' || v === 'hash'

const capitalize = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`

export const blurhashFieldName = (q: BlurhashQuality): string => `blurHash${capitalize(q)}`

export const webpFieldName = (q: WebpQuality): string => `placeholder${capitalize(q)}`

export const BLURHASH_FIELD_NAMES = BLURHASH_TIERS.map(blurhashFieldName)
export const WEBP_FIELD_NAMES = WEBP_TIERS.map(webpFieldName)

export const PLACEHOLDER_FIELD_NAMES = [...BLURHASH_FIELD_NAMES, ...WEBP_FIELD_NAMES]
