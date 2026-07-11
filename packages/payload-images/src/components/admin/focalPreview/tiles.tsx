'use client'

import type React from 'react'
import { useEffect, useRef } from 'react'

import { coverCropWindow } from '../../../lib/placeholders/window'
import { projectCoefficients } from '../../../lib/placeholders/cropCoefficients'
import { decodeToLinearGrid, linearToSrgb } from '../../../lib/placeholders/codec'
import { BLURHASH_QUALITIES, type BlurhashQuality, WEBP_QUALITIES, type WebpQuality } from '../../../lib/placeholders/qualities'
import type { HotspotOpts, ParsedBlurhash } from '../../../types'

const canvasStyle: React.CSSProperties = { display: 'block', width: '100%', height: '100%' }

/** Paints a focal-cropped blurhash: project the full hash onto the crop window at the tier's
 *  component count (pure math), decode a small grid, putImageData, let CSS scale it. */
export const BlurhashTile: React.FC<{
  hash: ParsedBlurhash
  srcAr: number
  tileAr: number
  hotspot: HotspotOpts
  quality: BlurhashQuality
}> = ({ hash, srcAr, tileAr, hotspot, quality }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const [cx, cy] = BLURHASH_QUALITIES[quality]
    const window = coverCropWindow(srcAr, tileAr, hotspot.focalX ?? 50, hotspot.focalY ?? 50, hotspot)
    const projected = projectCoefficients(hash, window, { cx, cy })
    const w = 44
    const h = Math.max(1, Math.round(w / tileAr))
    const grid = decodeToLinearGrid(projected, w, h)
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(w, h)
    for (let t = 0; t < h; t++)
      for (let s = 0; s < w; s++) {
        const o = (t * w + s) * 4
        const p = grid[t]![s]!
        img.data[o] = linearToSrgb(p[0])
        img.data[o + 1] = linearToSrgb(p[1])
        img.data[o + 2] = linearToSrgb(p[2])
        img.data[o + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  }, [hash, srcAr, tileAr, hotspot, quality])

  return <canvas ref={canvasRef} style={canvasStyle} aria-label="placeholder preview" />
}

/** Paints a micro-webp tier the way the server serves it: render the crop window of the stored
 *  full-frame placeholder into exactly its output pixels and let CSS upscale, so the tile matches
 *  the real placeholder's resolution (including `withoutEnlargement` on small sources). */
export const WebpTile: React.FC<{ src: string; srcAr: number; tileAr: number; hotspot: HotspotOpts; quality: WebpQuality }> = ({
  src,
  srcAr,
  tileAr,
  hotspot,
  quality,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const window = coverCropWindow(srcAr, tileAr, hotspot.focalX ?? 50, hotspot.focalY ?? 50, hotspot)
      const storedW = Math.min(WEBP_QUALITIES[quality], img.naturalWidth)
      const w = Math.max(1, Math.round(window.w * storedW))
      const h = Math.max(1, Math.round(w / tileAr))
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(
        img,
        window.x0 * img.naturalWidth,
        window.y0 * img.naturalHeight,
        window.w * img.naturalWidth,
        window.h * img.naturalHeight,
        0,
        0,
        w,
        h,
      )
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src, srcAr, tileAr, hotspot, quality])

  return <canvas ref={canvasRef} style={canvasStyle} aria-label="placeholder preview" />
}
