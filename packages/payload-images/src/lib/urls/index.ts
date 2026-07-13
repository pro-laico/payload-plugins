/**
 * Isomorphic URL builders for the on-demand transform endpoint — the published
 * `@pro-laico/payload-images/utils/urls` entry. No Node / Sharp / server imports, safe to
 * bundle into client components. Both accept an id or a populated doc; a doc also supplies
 * the cache-busting version token and the intrinsic-width cap.
 */
export { getImageUrl } from './getImageUrl'
export type { GetImageUrlOptions, ImageResource } from '../../types'
export { buildSrcset } from './srcset'
export type { BuildSrcsetOptions, BuildSrcsetResult } from '../../types'
export type { BuildUrlOptions } from '../../types'
export type { Fit, Format } from '../../types'
