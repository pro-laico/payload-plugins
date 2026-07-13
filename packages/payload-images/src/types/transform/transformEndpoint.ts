/** Public config for the on-demand transform endpoint. */
import type { PresetTemplate } from '../presets/preset'
import type { TransformConstraints } from './transformConstraints'

export interface TransformEndpointConfig extends Partial<TransformConstraints> {
  /** Source image collection slug. Default `images`. */
  sourceSlug?: string
  /** Generated-images collection slug. Default `generated-images`. */
  variantSlug?: string
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
  /** Per-image cap on cached variants (an image's own `variantLimit` field overrides it). Past the
   *  cap, a new freeform size is served from a nearby existing variant instead of generated + stored,
   *  bounding storage. Presets are exempt. Default 200. */
  variantLimit?: number
  /** Named preset templates, referenced by name from each image's `presets`. A default `og`
   *  (1200×630) ships unless overridden. */
  presetTemplates?: Record<string, PresetTemplate>
}
