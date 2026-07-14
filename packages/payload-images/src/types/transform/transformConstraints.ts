import type { Format } from './format'

export interface TransformConstraints {
  maxDimension: number
  qualityRange: [number, number]
  defaultQuality: number
  formats: Format[]
  defaultFormat: Format
  preferAvif: boolean
  dimensionStep: number
  widthLadder?: number[]
  maxInputPixels: number
}
