import { deflateSync } from 'node:zlib'

import type { BlurhashPngOptions } from '../../types'
import { decodeToLinearGrid, linearToSrgb, parseBlurhash } from './codec'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

const rgbPng = (pixels: Uint8Array, width: number, height: number): Buffer => {
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 2

  const raw = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1)

  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))])
}

export const blurhashToPngDataUri = (hash: string, opts: BlurhashPngOptions = {}): string => {
  const parsed = parseBlurhash(hash)
  const width = Math.max(1, Math.round(opts.width ?? 32))
  const height = Math.max(1, Math.round(opts.height ?? (opts.aspectRatio ? width / opts.aspectRatio : width)))
  const grid = decodeToLinearGrid(parsed, width, height)
  const pixels = new Uint8Array(width * height * 3)
  for (let t = 0; t < height; t++)
    for (let s = 0; s < width; s++) {
      const o = (t * width + s) * 3
      const p = grid[t]![s]!
      pixels[o] = linearToSrgb(p[0])
      pixels[o + 1] = linearToSrgb(p[1])
      pixels[o + 2] = linearToSrgb(p[2])
    }
  return `data:image/png;base64,${rgbPng(pixels, width, height).toString('base64')}`
}
