import type { PresetSpec } from '../presets/preset'
import type { TransformConstraints } from './transformConstraints'

export interface TransformEndpointConfig extends Partial<Omit<TransformConstraints, 'dimensionStep' | 'widthLadder'>> {
  cdnCacheControl?: boolean
  maxConcurrency?: number
  sharpConcurrency?: number
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
