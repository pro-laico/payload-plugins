/**
 * Isomorphic URL builders for the on-demand transform endpoint — the published
 * `@pro-laico/payload-images/utils/urls` entry. No Node / Sharp / server imports, safe to
 * bundle into client components.
 */
export { deriveVersion } from './version'
export type { VersionSource } from './version'
export { buildVariantUrl, DEFAULT_TRANSFORM_API_PATH } from './variantUrl'
export type { BuildUrlOptions } from './variantUrl'
export { buildSrcset, stepWidths } from './srcset'
export type { BuildSrcsetOptions, BuildSrcsetResult } from './srcset'
export { getImageUrl } from './getImageUrl'
export type { GetImageUrlOptions, ImageResource } from './getImageUrl'
export type { Fit, Format } from '../transform/params'
