export type FontkitFont = {
  familyName?: string | null
  subfamilyName?: string | null
  italicAngle?: number
  variationAxes?: Record<string, { min: number; default: number; max: number }> | null
  'OS/2'?: { usWeightClass?: number; fsSelection?: number } | null
}

export interface FontFileMetadata {
  familyName?: string
  weight?: string
  style?: 'normal' | 'italic'
  isVariable: boolean
  italCapable?: boolean
  obliqueAngle?: number
}

export type SubsetFontFn = (buffer: Buffer, text: string, options: { targetFormat: 'woff2' | 'woff' | 'sfnt' }) => Promise<Buffer>
