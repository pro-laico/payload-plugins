import type { Charset } from './charset'

export interface OptimizeFromOriginalsOptions {
  charset?: Charset
  originalSlug?: string
  optimizedSlug?: string
}

export interface Desired {
  originalId: string | number
  style: 'normal' | 'italic'
  isVariable: boolean
  weight?: string
}
