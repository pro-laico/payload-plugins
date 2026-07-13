/** The variant-bytes engine's types: the resolved source, the generation outcomes, and its args. */
import type { Payload } from 'payload'

import type { OutputFormat } from './format'
import type { ParsedParams } from './transformParams'
import type { UploadDocLike } from './uploadDoc'

/** A resolved source doc: id + where-the-bytes-live + focal/hotspot layers. */
export type VariantSourceDoc = UploadDocLike & {
  id: string | number
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

/** Generation outcome (bytes or a typed failure). */
export type GenBytes = { ok: true; data: Buffer; mimeType: string } | { ok: false; status: number; msg: string }

/** Optional generation coalescer (the endpoint passes its per-process single-flight). */
export type GenFlight = (key: string, fn: () => Promise<GenBytes>) => Promise<GenBytes>

/** Result of {@link getOrCreateVariantBytes} — bytes + the cache key (for ETag), or a typed failure. */
export type VariantBytes = { ok: true; data: Buffer; mimeType: string; key: string } | { ok: false; status: number; msg: string; key: string }

export interface GetVariantBytesArgs {
  payload: Payload
  source: VariantSourceDoc
  /** Parsed + snapped transform params. */
  params: ParsedParams
  /** Concrete output format (never `auto`). */
  format: OutputFormat
  sourceSlug: string
  variantSlug: string
  /** Origin used to read originals/variants served from a relative/cloud URL. */
  base: string
  /** Decompression-bomb / memory guard passed to Sharp. */
  maxInputPixels: number
  genFlight?: GenFlight
  /** How the generated variant row is persisted:
   *  - `true` (default): via Next `after()` (post-response) — the request path.
   *  - `false`: awaited inline — job/CLI contexts with no request to defer behind.
   *  - `'never'`: NOT persisted — serve the bytes but add no storage (the at-cap path). */
  deferPersist?: boolean | 'never'
  /** Pre-read original bytes, to avoid re-reading the source per variant (the prewarm job reads
   *  once and passes them through). Omit and the engine reads (coalescing concurrent reads). */
  originalBytes?: Buffer
}
