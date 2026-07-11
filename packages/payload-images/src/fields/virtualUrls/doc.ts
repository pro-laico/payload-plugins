/**
 * The doc shape the virtual URL fields read, the compute context every URL builder gets, and the
 * natural-ratio helper. A leaf shared by the field builders (fields/virtualUrls) and their
 * afterRead hooks (hooks/field) — depended on both ways, so it imports neither.
 */
import type { ParsedRenderIntent } from '../../lib/renderIntent'

export interface ImageDocLike {
  id?: string | number
  width?: number | null
  height?: number | null
  filename?: string | null
  url?: string | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

export const naturalAspectRatio = (d: ImageDocLike): number | undefined => (d.width && d.height ? d.width / d.height : undefined)

/** What every URL computer gets: the origin, the project's srcset step, and the declared render. */
export interface ComputeContext {
  baseUrl: string
  pixelStep?: number | number[]
  intent: ParsedRenderIntent
}
