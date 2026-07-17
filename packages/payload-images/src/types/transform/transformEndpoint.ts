import type { PresetSpec } from '../presets/preset'
import type { TransformConstraints } from './transformConstraints'

export interface TransformEndpointConfig extends Partial<Omit<TransformConstraints, 'dimensionStep' | 'widthLadder'>> {
  /** Send a long-lived immutable `Cache-Control` on variant responses. */
  cdnCacheControl?: boolean
  /** Max transforms in flight; the rest queue. Default: CPU count − 1. */
  maxConcurrency?: number
  /** Sharp's own thread pool size per transform. */
  sharpConcurrency?: number
  /** While a variant is cold, serve a ready nearby one immediately instead of waiting. */
  fallback?: boolean
}

export interface TransformEndpointArgs extends TransformEndpointConfig {
  sourceSlug: string
  variantSlug: string
  variantLimit: number
  presetTemplates: Record<string, PresetSpec>
  dimensionStep?: number
  widthLadder?: number[]
}
