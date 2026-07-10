/**
 * The shared "give me the bytes for this variant" engine: compute the cache key, return the
 * cached variant if one exists, otherwise generate it with Sharp once, persist it after the
 * response, and return the bytes. The on-demand `/api/img` route runs this
 * read-or-generate-or-persist path against the one `generated-images` cache — a given
 * (source, size, fit, quality, format) variant is generated once.
 */
import { after } from 'next/server'

import type { CollectionSlug, Payload } from 'payload'

import { variantCacheKey } from '../variants/key'
import { extForFormat, mimeForFormat, type OutputFormat, type ParsedParams } from './params'
import { transformImage, type TransformOutput } from './sharp'
import { readBytes, resolveStaticDir, type UploadDocLike } from './source'

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

/** True for a foreign-key violation on the variant create: the SOURCE doc was deleted while
 *  this persist was in flight (post-response fire-and-forget), so the variant has nothing to
 *  attach to. Expected in delete/reseed races — the bytes were already served; dropping the
 *  cache row is the correct outcome, not an error. Same cause-chain walk as the duplicate
 *  detector (sqlite SQLITE_CONSTRAINT_FOREIGNKEY, postgres 23503, mysql ER_NO_REFERENCED_ROW). */
const isForeignKeyError = (err: unknown): boolean => {
  let e: unknown = err
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = (e as { code?: unknown })?.code
    if (/foreign key/i.test(msg) || /FOREIGNKEY|23503|ER_NO_REFERENCED_ROW/.test(`${typeof code === 'string' ? code : ''}`)) return true
    e = (e as { cause?: unknown })?.cause
  }
  return false
}

/** True when Sharp itself failed to load (module missing or native binding broken) — the fix is
 *  the install, not this image, so the generic "transform failed" line alone would mislead. */
const isSharpLoadError = (err: unknown): boolean => {
  const s = `${String(err)} ${String((err as { code?: unknown })?.code ?? '')}`
  return /sharp|libvips/i.test(s) && /cannot find module|module_not_found|could not load|native|binding/i.test(s)
}

/** The actionable fix for a Sharp load failure — shared by the boot probe and the request-time catch. */
export const SHARP_INSTALL_HINT = "install it (`pnpm add sharp`) and externalize it in next.config (`serverExternalPackages: ['sharp']`)"

/** Once-per-process latch for the cache-lookup warning below. */
let warnedCacheLookup = false

/**
 * Return the bytes for one variant: cache hit → stored copy; miss → Sharp once, persist after
 * the response (via Next's `after()`, falling back to fire-and-forget), then return the bytes.
 * Generation is coalesced by cache key when a `genFlight` is supplied.
 */
export const getOrCreateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> => {
  const { payload, source: src, params: p, format, sourceSlug, variantSlug, base, maxInputPixels, genFlight } = args
  const key = variantCacheKey(src, p, format)

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
  } catch (err) {
    // Fall through to regeneration, but not SILENTLY: a broken variant collection would otherwise
    // masquerade as a perpetual cache miss — every request re-transforms, with zero signal.
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
        if (isForeignKeyError(err)) {
          // Source vanished between generation and persist — served the bytes, skip the cache row.
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
