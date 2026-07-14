import type { Payload } from 'payload'

import type { OutputFormat } from './format'
import type { UploadDocLike } from './uploadDoc'
import type { ParsedParams } from './transformParams'

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

export type GenBytes = { ok: true; data: Buffer; mimeType: string } | { ok: false; status: number; msg: string }

export type GenFlight = (key: string, fn: () => Promise<GenBytes>) => Promise<GenBytes>

export type VariantBytes = { ok: true; data: Buffer; mimeType: string; key: string } | { ok: false; status: number; msg: string; key: string }

export interface GetVariantBytesArgs {
  payload: Payload
  source: VariantSourceDoc
  params: ParsedParams
  format: OutputFormat
  sourceSlug: string
  variantSlug: string
  base: string
  maxInputPixels: number
  genFlight?: GenFlight
  deferPersist?: boolean | 'never'
  originalBytes?: Buffer
}
