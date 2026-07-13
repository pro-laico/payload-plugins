/** Public config for the on-demand transform endpoint. */
import type { PresetSpec } from '../presets/preset'
import type { TransformConstraints } from './transformConstraints'

export interface TransformEndpointConfig extends Partial<Omit<TransformConstraints, 'dimensionStep' | 'widthLadder'>> {
  /** Also emit `CDN-Cache-Control` / `Vercel-CDN-Cache-Control` (edge caching). Default true. */
  cdnCacheControl?: boolean
  /** Max concurrent Sharp transforms in this process (default `cpus - 1`, or `IMAGES_TRANSFORM_CONCURRENCY`). */
  maxConcurrency?: number
  /** Per-image libvips thread cap (default 1 for serverless safety; `0` = CPU cores, or `IMAGES_SHARP_CONCURRENCY`). */
  sharpConcurrency?: number
  /** On a cache miss with a NEARBY variant ready (same fit + aspect ratio, any quality/width/
   *  format), serve it immediately with `Cache-Control: no-store` while the exact variant
   *  generates in the background — the next request gets the exact one. Default true. */
  fallback?: boolean
}

/** Internal: the endpoint factory's full wiring — the public config plus everything the plugin
 *  resolves itself (slugs, the cap, the merged templates, and the pixelStep-derived snapping). */
export interface TransformEndpointArgs extends TransformEndpointConfig {
  sourceSlug: string
  variantSlug: string
  variantLimit: number
  presetTemplates: Record<string, PresetSpec>
  dimensionStep?: number
  widthLadder?: number[]
}
