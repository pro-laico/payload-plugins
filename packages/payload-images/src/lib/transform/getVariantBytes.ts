/**
 * The shared "give me the bytes for this variant" engine: cache hit → stored copy; miss → Sharp
 * once, respond immediately, persist after the response — so a given (source, size, fit, quality,
 * format) variant is only ever generated once.
 */
import { after } from 'next/server'
import type { CollectionSlug, Payload } from 'payload'

import { variantCacheKey } from './variantKey'
import { resolveStaticDir } from './staticDir'
import { transformImage, type TransformOutput } from './sharp'
import { readBytes, type UploadDocLike } from './source'
import { extForFormat, mimeForFormat, type OutputFormat, type ParsedParams } from './params'

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
type GenFlight = (key: string, fn: () => Promise<GenBytes>) => Promise<GenBytes>

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
}

const errorCode = (e: unknown): unknown => (typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined)
const errorCause = (e: unknown): unknown => (typeof e === 'object' && e !== null && 'cause' in e ? e.cause : undefined)

/** Unique-constraint violation on the variant create: two requests raced the same cache miss and
 *  the loser is expected, not noise. Arrives as a raw driver error, a wrapper whose `cause`
 *  carries the code, or Payload's ValidationError on `cacheKey` — walk all three. */
const isDuplicateKeyError = (err: unknown): boolean => {
  let e: unknown = err
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = errorCode(e)
    if (/duplicate|unique/i.test(`${msg} ${typeof code === 'string' ? code : ''}`)) return true
    e = errorCause(e)
  }
  const data = typeof err === 'object' && err !== null && 'data' in err ? err.data : undefined
  const fieldErrors = typeof data === 'object' && data !== null && 'errors' in data ? data.errors : undefined
  if (!Array.isArray(fieldErrors)) return false
  return fieldErrors.some((f: unknown) => {
    if (typeof f !== 'object' || f === null) return false
    if ('path' in f && f.path === 'cacheKey') return true
    return 'message' in f && typeof f.message === 'string' && /unique/i.test(f.message)
  })
}

/** Foreign-key violation on the variant create: the SOURCE was deleted while this post-response
 *  persist was in flight. The bytes were already served; dropping the cache row is correct. */
const isForeignKeyError = (err: unknown): boolean => {
  let e: unknown = err
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = errorCode(e)
    if (/foreign key/i.test(msg) || /FOREIGNKEY|23503|ER_NO_REFERENCED_ROW/.test(`${typeof code === 'string' ? code : ''}`)) return true
    e = errorCause(e)
  }
  return false
}

/** Sharp itself failed to load — the fix is the install, not this image. */
const isSharpLoadError = (err: unknown): boolean => {
  const s = `${String(err)} ${String(errorCode(err) ?? '')}`
  return /sharp|libvips/i.test(s) && /cannot find module|module_not_found|could not load|native|binding/i.test(s)
}

/** The actionable fix for a Sharp load failure — shared by the boot probe and the request-time catch. */
export const SHARP_INSTALL_HINT = "install it (`pnpm add sharp`) and externalize it in next.config (`serverExternalPackages: ['sharp']`)"

let warnedCacheLookup = false

export const getOrCreateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> => {
  const { payload, source: src, params: p, format, sourceSlug, variantSlug, base, maxInputPixels, genFlight } = args
  const key = variantCacheKey(src, p, format)

  try {
    const hit = await payload.find({
      collection: variantSlug as CollectionSlug, //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
      where: { cacheKey: { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const variant = hit?.docs?.[0] as (UploadDocLike & { id: string | number }) | undefined //EXCUSE: docs of a runtime-configured collection are untyped; readBytes null-guards every field
    if (variant) {
      const bytes = await readBytes(variant, resolveStaticDir(payload, variantSlug), base, { payload, slug: variantSlug })
      if (bytes) return { ok: true, data: bytes, mimeType: mimeForFormat(format), key }
    }
  } catch (err) {
    if (!warnedCacheLookup) {
      warnedCacheLookup = true
      payload.logger.warn({
        msg: `[payload-images] variant cache lookup failed for '${variantSlug}' — falling back to regenerating on every request until this is fixed (warns once per process).`,
        err,
      })
    }
  }

  const generate = async (): Promise<GenBytes> => {
    const original = await readBytes(src, resolveStaticDir(payload, sourceSlug), base, { payload, slug: sourceSlug })
    if (!original) {
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
        hotspot: {
          focalSize: src.focalSize,
          cropLeft: src.cropLeft,
          cropTop: src.cropTop,
          cropRight: src.cropRight,
          cropBottom: src.cropBottom,
        },
        maxInputPixels,
      })
    } catch (err) {
      const hint = isSharpLoadError(err) ? ` — sharp failed to load; ${SHARP_INSTALL_HINT}` : ''
      payload.logger.error(`[payload-images] transform failed for ${src.id}: ${String(err)}${hint}`)
      return { ok: false, status: 500, msg: 'Transform failed' }
    }

    const persist = async (): Promise<void> => {
      try {
        await payload.create({
          collection: variantSlug as CollectionSlug, //EXCUSE: runtime-configured slug can't satisfy the consuming app's generated CollectionSlug union
          file: { data: out.data, mimetype: out.mimeType, name: `${key}.${extForFormat(format)}`, size: out.data.byteLength },
          data: {
            source: src.id as never, //EXCUSE: data for a runtime-configured collection can't satisfy the generated per-collection data type
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
        if (isForeignKeyError(err)) {
          payload.logger.info(`[payload-images] source ${src.id} was deleted before variant ${key} persisted — skipped.`)
        } else if (!isDuplicateKeyError(err)) {
          payload.logger.warn(`[payload-images] failed to persist variant ${key} for source ${src.id}: ${String(err)}`)
        }
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
