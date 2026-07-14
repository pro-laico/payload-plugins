import type { VersionSource } from './versionSource'
import type { BuildUrlOptions } from './buildUrlOptions'

export type ImageResource = string | number | ({ id: string | number; width?: number | null } & VersionSource) | null | undefined

export interface GetImageUrlOptions extends BuildUrlOptions {
  width?: number
  baseUrl?: string
}
