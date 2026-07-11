/**
 * The shared "give me the bytes for this variant" engine: cache hit → stored copy; miss → Sharp
 * once, respond immediately, persist after the response — so a given (source, size, fit, quality,
 * format) variant is only ever generated once.
 */
import { after } from 'next/server'
import type { CollectionSlug } from 'payload'

import { variantCacheKey } from './variantKey'
import { resolveStaticDir } from './staticDir'
import { transformImage } from './sharp'
import { readBytes } from './source'
import { extForFormat, mimeForFormat } from './params'
import { TransformOverloadError } from './limit'
import { isDuplicateKeyError, isForeignKeyError } from '../errors'
import type { GenBytes, GetVariantBytesArgs, TransformOutput, UploadDocLike, VariantBytes } from '../../types'

const errorCode = (e: unknown): unknown => (typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined)

/** Sharp itself failed to load — the fix is the install, not this image. */
const isSharpLoadError = (err: unknown): boolean => {
  const s = `${String(err)} ${String(errorCode(err) ?? '')}`
  return /sharp|libvips/i.test(s) && /cannot find module|module_not_found|could not load|native|binding/i.test(s)
}

/** The actionable fix for a Sharp load failure — shared by the boot probe and the request-time catch. */
export const SHARP_INSTALL_HINT = "install it (`pnpm add sharp`) and externalize it in next.config (`serverExternalPackages: ['sharp']`)"

let warnedCacheLookup = false

/** The cache-hit half of the engine: exact-key lookup + stored bytes, or null on any miss —
 *  including a failed lookup (warned once per process), which degrades to regeneration. */
export const getCachedVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes | null> => {
  const { payload, source: src, params: p, format, variantSlug, base } = args
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
  return null
}

/** The generation half: Sharp once (coalesced per key via `genFlight`), persist per `deferPersist`. */
export const generateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> => {
  const { payload, source: src, params: p, format, sourceSlug, variantSlug, base, maxInputPixels, genFlight } = args
  const key = variantCacheKey(src, p, format)

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
      // Queue full → shed load with 503 (transient), don't log it as a transform error.
      if (err instanceof TransformOverloadError) return { ok: false, status: 503, msg: 'Server busy' }
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
    // A request context defers the row write until after the response flushes; a job/CLI context
    // has no after() and must not fire-and-forget (the process may exit mid-persist).
    if (args.deferPersist === false) {
      await persist()
    } else {
      try {
        after(persist)
      } catch {
        void persist()
      }
    }

    return { ok: true, data: out.data, mimeType: out.mimeType }
  }

  const result = genFlight ? await genFlight(key, generate) : await generate()
  return result.ok
    ? { ok: true, data: result.data, mimeType: result.mimeType, key }
    : { ok: false, status: result.status, msg: result.msg, key }
}

export const getOrCreateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> =>
  (await getCachedVariantBytes(args)) ?? generateVariantBytes(args)
