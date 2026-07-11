/** The `getImageUrl` resource + options — a single transform URL from an id or a populated doc. */
import type { BuildUrlOptions } from './buildUrlOptions'
import type { VersionSource } from './versionSource'

/** A bare id, or a populated image doc (so the version token + a default width can be read off it). */
export type ImageResource = string | number | ({ id: string | number; width?: number | null } & VersionSource) | null | undefined

export interface GetImageUrlOptions extends BuildUrlOptions {
  /** Output width. Falls back to a populated doc's intrinsic width, else 1280. */
  width?: number
  /** Prefix for absolute URLs. Defaults to `NEXT_PUBLIC_SERVER_URL`; pass `''` for a relative URL. */
  baseUrl?: string
}
