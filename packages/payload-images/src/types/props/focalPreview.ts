/** Local UI state types for the admin focal/hotspot preview editor. */

export type DisplayMode = 'normal' | 'half' | 'blurhash'

export interface FocalPreviewProps {
  previewRatios?: string[]
  readOnly?: boolean
}

export type DragMode = 'focal' | 'size' | 'crop-nw' | 'crop-se' | null
