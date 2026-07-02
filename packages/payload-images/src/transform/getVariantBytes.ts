/**
 * The shared "give me the bytes for this variant" engine: compute the cache key, return the
 * cached variant if one exists, otherwise generate it with Sharp once, persist it after the
 * response, and return the bytes. Extracted from the transform endpoint so the on-demand
 * `/api/img` route and `<ResponsiveImage>`'s inline LQIP run the EXACT same
 * read-or-generate-or-persist path against the one `generated-images` cache — a given
 * (source, size, fit, quality, format) variant is generated once, whichever door triggered it.
 */
import { after } from 'next/server'

import type { CollectionSlug, Payload } from 'payload'

import { variantCacheKey } from '../variants/key'
import { extForFormat, mimeForFormat, type OutputFormat, type ParsedParams } from './params'
import { transformImage, type TransformOutput } from './sharp'
import { readBytes, resolveStaticDir, type UploadDocLike } from './source'

/** A resolved source doc: id + where-the-bytes-live + focal point. */
export type VariantSourceDoc = UploadDocLike & { id: string | number; focalX?: number | null; focalY?: number | null }

/** Generation outcome (bytes or a typed failure). */
export type GenBytes = { ok: true; data: Buffer; mimeType: string } | { ok: false; status: number; msg: string }

/** Optional generation coalescer (the endpoint passes its per-process single-flight; omit at render). */
type GenFlight = (key: string, fn: () => Promise<GenBytes>) => Promise<GenBytes>

/** Result of {@link getOrCreateVariantBytes} — bytes + the cache key (for ETag), or a typed failure. */
export type VariantBytes = { ok: true; data: Buffer; mimeType: string; key: string } | { ok: false; status: number; msg: string; key: string }

export interface GetVariantBytesArgs {
  payload: Payload
  /** Resolved source doc (id + filename/url + focal point). */
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
  /** Generation coalescer; the endpoint passes its single-flight, render-time callers omit it. */
  genFlight?: GenFlight
}

/** True for a unique-constraint violation on the variant create. Two requests racing the same
 *  cache miss both persist; the loser is expected, not noise. The violation arrives in several
 *  shapes — a raw driver error mentioning duplicate/unique, a wrapper (drizzle's "Failed query:
 *  insert …") whose `cause` carries the code (e.g. SQLITE_CONSTRAINT_UNIQUE), or Payload's
 *  ValidationError ("The following field is invalid: cacheKey") — so walk the cause chain and
 *  the field errors. */
const isDuplicateKeyError = (err: unknown): boolean => {
  let e: unknown = err
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = (e as { code?: unknown })?.code
    if (/duplicate|unique/i.test(`${msg} ${typeof code === 'string' ? code : ''}`)) return true
    e = (e as { cause?: unknown })?.cause
  }
  const fieldErrors = (err as { data?: { errors?: Array<{ message?: string; path?: string }> } })?.data?.errors
  return Array.isArray(fieldErrors) && fieldErrors.some((f) => f.path === 'cacheKey' || /unique/i.test(f.message ?? ''))
}

/**
 * Return the bytes for one variant: cache hit → stored copy; miss → Sharp once, persist after
 * the response (via Next's `after()`, falling back to fire-and-forget), then return the bytes.
 * Generation is coalesced by cache key when a `genFlight` is supplied.
 */
export const getOrCreateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> => {
  const { payload, source: src, params: p, format, sourceSlug, variantSlug, base, maxInputPixels, genFlight } = args
  const key = variantCacheKey({ id: src.id, filename: src.filename, focalX: src.focalX, focalY: src.focalY }, p, format)

  // Cache hit → the stored variant's bytes.
  try {
    const hit = await payload.find({
      collection: variantSlug as CollectionSlug,
      where: { cacheKey: { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const variant = hit?.docs?.[0] as (UploadDocLike & { id: string | number }) | undefined
    if (variant) {
      const bytes = await readBytes(variant, resolveStaticDir(payload, variantSlug), base, { payload, slug: variantSlug })
      if (bytes) return { ok: true, data: bytes, mimeType: mimeForFormat(format), key }
    }
  } catch {}

  const generate = async (): Promise<GenBytes> => {
    const original = await readBytes(src, resolveStaticDir(payload, sourceSlug), base, { payload, slug: sourceSlug })
    if (!original) {
      // Only the relative-URL path needs an origin to resolve; surface the serverURL hint
      // just here, when a read has actually failed — not preemptively at boot.
      const relative = !!src.url && !/^https?:\/\//i.test(src.url)
      const hint = relative ? ' — relative-URL storage and the request origin did not resolve; set serverURL in buildConfig' : ''
      payload.logger.warn(`[payload-images] source ${src.id} unreadable (filename=${src.filename ?? 'none'}, url=${src.url ?? 'none'})${hint}`)
      return { ok: false, status: 502, msg: 'Source unavailable' }
    }

    let out: TransformOutput
    try {
      out = await transformImage(original, {
        w: p.w,
        h: p.h,
        fit: p.fit,
        quality: p.q,
        format,
        focalX: src.focalX,
        focalY: src.focalY,
        maxInputPixels,
      })
    } catch (err) {
      payload.logger.error(`[payload-images] transform failed for ${src.id}: ${String(err)}`)
      return { ok: false, status: 500, msg: 'Transform failed' }
    }

    const persist = async (): Promise<void> => {
      try {
        await payload.create({
          collection: variantSlug as CollectionSlug,
          file: { data: out.data, mimetype: out.mimeType, name: `${key}.${extForFormat(format)}`, size: out.data.byteLength },
          data: {
            source: src.id as never,
            cacheKey: key,
            fit: p.fit,
            format,
            quality: p.q,
            focalX: src.focalX ?? null,
            focalY: src.focalY ?? null,
          },
          overwriteExistingFiles: true,
          overrideAccess: true,
        })
      } catch (err) {
        if (!isDuplicateKeyError(err))
          payload.logger.warn(`[payload-images] failed to persist variant ${key} for source ${src.id}: ${String(err)}`)
      }
    }
    try {
      after(persist)
    } catch {
      void persist()
    }

    return { ok: true, data: out.data, mimeType: out.mimeType }
  }

  const result = genFlight ? await genFlight(key, generate) : await generate()
  return result.ok
    ? { ok: true, data: result.data, mimeType: result.mimeType, key }
    : { ok: false, status: result.status, msg: result.msg, key }
}
