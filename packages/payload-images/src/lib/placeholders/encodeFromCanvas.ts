import { BLURHASH_QUALITIES } from './qualities'
import { encodeLinearGrid, srgbToLinear } from './codec'
import type { LinearGrid, ParsedBlurhash } from '../../types'

const SAMPLE_EDGE = 64

const MAX_COMPONENTS = Object.values(BLURHASH_QUALITIES).reduce<[number, number]>(
  (acc, [cx, cy]) => [Math.max(acc[0], cx), Math.max(acc[1], cy)],
  [1, 1],
)

export const encodeBlurhashFromImageSource = async (src: string, cx = MAX_COMPONENTS[0], cy = MAX_COMPONENTS[1]): Promise<ParsedBlurhash> => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`[payload-images] blurhash preview: could not load ${src}`))
    img.src = src
  })

  const scale = SAMPLE_EDGE / Math.max(img.naturalWidth, img.naturalHeight)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('[payload-images] blurhash preview: no 2d canvas context')
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const grid: LinearGrid = []
  for (let t = 0; t < h; t++) {
    const row: [number, number, number][] = []
    for (let s = 0; s < w; s++) {
      const o = (t * w + s) * 4
      row.push([srgbToLinear(data[o]!), srgbToLinear(data[o + 1]!), srgbToLinear(data[o + 2]!)])
    }
    grid.push(row)
  }
  return encodeLinearGrid(grid, cx, cy)
}
