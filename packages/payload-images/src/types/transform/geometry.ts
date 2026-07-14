export interface HotspotOpts {
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

export interface CropWindowRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CropGeometry {
  resizeWidth: number
  resizeHeight: number
  left: number
  top: number
  width: number
  height: number
}
