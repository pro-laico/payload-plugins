/**
 * The virtual `croppedBlurHash` field — the read-side half of the placeholder pipeline.
 * The processing lives HERE, in the field hook next to the sibling data (tier values,
 * dimensions, focal, hotspot, crop), so consumers select ONE field and render the string
 * they get back. Three behaviors, chosen by the read:
 *
 *  - **no declared intent** → the raw `sm` tier hash, uncropped (28 chars) — admin, list,
 *    and API reads that never render a placeholder stay light.
 *  - **declared intent** (`req.context.blurhash = { ar, quality }`, or an
 *    `X-Blurhash: ar=16/9; q=md` header) → a FINISHED placeholder data URI, focal-cropped
 *    to the requested aspect ratio: hash tiers render to a tiny inline PNG (coefficient
 *    crop, pure math); webp tiers (`xxl`/`x3`) crop the stored micro-webp (a ~1 KB Sharp
 *    decode, milliseconds).
 *  - **`format: 'hash'`** → the focal-cropped raw hash string, for consumers decoding
 *    client-side with a stock blurhash library (hash tiers only; webp tiers fall back to
 *    `xl`).
 */
import type { Field, FieldHook } from 'payload'

import { blurhashToPngDataUri } from '../blurhash/png'
import { parseAspectRatio } from '../transform/params'
import { cropWebpDataUri } from '../blurhash/webpPlaceholder'
import { coverCropWindow, type CropWindow } from '../blurhash/window'
import { cropBlurhashCoefficients } from '../blurhash/cropCoefficients'
import {
  BLURHASH_QUALITIES,
  type BlurhashQuality,
  blurhashFieldName,
  DEFAULT_BLURHASH_QUALITY,
  isBlurhashQuality,
  isPlaceholderQuality,
  isWebpQuality,
  PLACEHOLDER_FIELD_NAMES,
  type PlaceholderQuality,
  WEBP_QUALITIES,
  webpFieldName,
  type WebpQuality,
} from '../blurhash/qualities'

const d = {
  croppedBlurHash:
    'Placeholder for the read: a finished data URI focal-cropped to the declared render (req.context.blurhash = { ar, quality, format } or an X-Blurhash header); the raw sm-tier hash when nothing is declared.',
}

export type PlaceholderFormat = 'uri' | 'hash'

export interface BlurhashRequest {
  /** Target aspect ratio (`16/9`, `"16:9"`, `1.78`) — crops the placeholder to match, from the focal point. */
  ar?: number
  /** Placeholder tier: `xs`…`xl` (blurhash) or `xxl`/`x3` (micro-webp). Default `sm`. */
  quality?: PlaceholderQuality
  /** `uri` (default): a finished data URI, ready to paint. `hash`: the cropped raw hash string
   *  (hash tiers only — for stock blurhash decoders). */
  format?: PlaceholderFormat
}

const isFormat = (v: unknown): v is PlaceholderFormat => v === 'uri' || v === 'hash'

/** Parse an `X-Blurhash` header: a bare ratio (`16/9`) or a `;`-list (`ar=16/9; q=md; format=hash`). */
const parseHeader = (h: string): BlurhashRequest => {
  const out: BlurhashRequest = {}
  for (const part of h.split(';')) {
    const s = part.trim()
    if (!s) continue
    const eq = s.indexOf('=')
    if (eq === -1) {
      if (isPlaceholderQuality(s)) out.quality = out.quality ?? s
      else if (isFormat(s)) out.format = out.format ?? s
      else out.ar = out.ar ?? parseAspectRatio(s)
      continue
    }
    const k = s.slice(0, eq).trim().toLowerCase()
    const v = s.slice(eq + 1).trim()
    if (k === 'ar') out.ar = parseAspectRatio(v)
    else if ((k === 'q' || k === 'quality') && isPlaceholderQuality(v)) out.quality = v
    else if (k === 'format' && isFormat(v)) out.format = v
  }
  return out
}

/** Read the blurhash request off the operation: `req.context.blurhash` (Local API) or the `X-Blurhash` header (REST). */
const readRequest = (
  req: { context?: Record<string, unknown>; headers?: { get?: (k: string) => string | null } } | undefined,
): BlurhashRequest => {
  const ctx = req?.context?.blurhash
  if (ctx && typeof ctx === 'object') {
    const o = ctx as { ar?: number | string; quality?: unknown; format?: unknown }
    return {
      ar: parseAspectRatio(o.ar),
      quality: isPlaceholderQuality(o.quality) ? o.quality : undefined,
      format: isFormat(o.format) ? o.format : undefined,
    }
  }
  const header = req?.headers?.get?.('x-blurhash')
  return header ? parseHeader(header) : {}
}

interface ImageDocLike {
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
  [key: string]: unknown
}

const storedString = (doc: ImageDocLike, field: string): string | undefined => {
  const v = doc[field]
  return typeof v === 'string' && v ? v : undefined
}

/** The best stored hash at or below the requested tier (docs predating a tier still get
 *  the best placeholder they have, instead of none). */
const storedHash = (doc: ImageDocLike, quality: BlurhashQuality): string | undefined => {
  const tiers = Object.keys(BLURHASH_QUALITIES) as BlurhashQuality[]
  for (let i = tiers.indexOf(quality); i >= 0; i--) {
    const hash = storedString(doc, blurhashFieldName(tiers[i]!))
    if (hash) return hash
  }
  return undefined
}

/** The best stored micro-webp at or below the requested tier. */
const storedWebp = (doc: ImageDocLike, quality: WebpQuality): string | undefined => {
  const tiers = Object.keys(WEBP_QUALITIES) as WebpQuality[]
  for (let i = tiers.indexOf(quality); i >= 0; i--) {
    const uri = storedString(doc, webpFieldName(tiers[i]!))
    if (uri) return uri
  }
  return undefined
}

/** The focal/hotspot crop window for a requested aspect ratio, or undefined when there's nothing to crop to. */
const cropWindow = (doc: ImageDocLike, ar: number | undefined): CropWindow | undefined => {
  const sw = typeof doc.width === 'number' ? doc.width : undefined
  const sh = typeof doc.height === 'number' ? doc.height : undefined
  if (!ar || !sw || !sh) return undefined
  return coverCropWindow(sw / sh, ar, doc.focalX ?? 50, doc.focalY ?? 50, {
    focalSize: doc.focalSize,
    cropLeft: doc.cropLeft,
    cropTop: doc.cropTop,
    cropRight: doc.cropRight,
    cropBottom: doc.cropBottom,
  })
}

export const croppedBlurhashField = (): Field => {
  const afterRead: FieldHook = async ({ data, req }) => {
    const doc = (data ?? {}) as ImageDocLike
    const wanted = readRequest(req)

    if (wanted.ar === undefined && wanted.quality === undefined && wanted.format === undefined)
      return storedHash(doc, DEFAULT_BLURHASH_QUALITY) ?? null

    const quality = wanted.quality ?? DEFAULT_BLURHASH_QUALITY

    if (wanted.format === 'hash') {
      const hash = storedHash(doc, isBlurhashQuality(quality) ? quality : 'xl')
      if (!hash) return null
      const window = cropWindow(doc, wanted.ar)
      if (!window) return hash
      try {
        return cropBlurhashCoefficients(hash, window)
      } catch {
        return hash
      }
    }

    if (isWebpQuality(quality)) {
      const uri = storedWebp(doc, quality)
      if (uri) {
        const window = cropWindow(doc, wanted.ar)
        return window ? await cropWebpDataUri(uri, window) : uri
      }
    }

    const hash = storedHash(doc, isBlurhashQuality(quality) ? quality : 'xl')
    if (!hash) return null
    try {
      const window = cropWindow(doc, wanted.ar)
      const cropped = window ? cropBlurhashCoefficients(hash, window) : hash
      const sw = typeof doc.width === 'number' ? doc.width : undefined
      const sh = typeof doc.height === 'number' ? doc.height : undefined
      const ar = wanted.ar ?? (sw && sh ? sw / sh : undefined)
      return blurhashToPngDataUri(cropped, ar ? { aspectRatio: ar } : {})
    } catch {
      return null
    }
  }
  return {
    name: 'croppedBlurHash',
    type: 'text',
    virtual: true,
    admin: { hidden: true, description: d.croppedBlurHash },
    hooks: { afterRead: [afterRead] },
  }
}

/** The stored placeholder tier fields (`blurHashXs`…`blurHashXl`, `placeholderXxl`/`placeholderX3`)
 *  — written by the upload hook, hidden in the admin. */
export const blurhashStorageFields = (): Field[] =>
  PLACEHOLDER_FIELD_NAMES.map((name) => ({ name, type: 'text', admin: { hidden: true, readOnly: true } }))
