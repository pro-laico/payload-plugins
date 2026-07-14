import { after } from 'next/server'

import { asSlug } from '../asSlug'
import { isRecord } from '../isRecord'
import { readBytes } from './source'
import { transformImage } from './sharp'
import { variantCacheKey } from './variantKey'
import { resolveStaticDir } from './staticDir'
import { TransformOverloadError } from './limit'
import { extForFormat, mimeForFormat } from './params'
import { isDuplicateKeyError, isForeignKeyError } from '../errors'
import type { GenBytes, GetVariantBytesArgs, TransformOutput, VariantBytes } from '../../types'

const errorCode = (e: unknown): unknown => (typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined)

const isSharpLoadError = (err: unknown): boolean => {
  const s = `${String(err)} ${String(errorCode(err) ?? '')}`
  return /sharp|libvips/i.test(s) && /cannot find module|module_not_found|could not load|native|binding/i.test(s)
}

export const SHARP_INSTALL_HINT = "install it (`pnpm add sharp`) and externalize it in next.config (`serverExternalPackages: ['sharp']`)"

let warnedCacheLookup = false

const originalReadFlight = new Map<string, Promise<Buffer | null>>()

const readOriginalCoalesced = (args: GetVariantBytesArgs): Promise<Buffer | null> => {
  const { payload, source: src, sourceSlug, base } = args
  const key = `${sourceSlug}|${src.id}|${src.filename ?? ''}`
  const existing = originalReadFlight.get(key)
  if (existing) return existing
  const p = readBytes(src, resolveStaticDir(payload, sourceSlug), base, { payload, slug: sourceSlug }).finally(() =>
    originalReadFlight.delete(key),
  )
  originalReadFlight.set(key, p)
  return p
}

export const getCachedVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes | null> => {
  const { payload, source: src, params: p, format, variantSlug, base } = args
  const key = variantCacheKey(src, p, format)

  try {
    const hit = await payload.find({
      collection: asSlug(variantSlug),
      where: { cacheKey: { equals: key } },
      limit: 1,
      depth: 0,
    })
    const hitDoc = hit?.docs?.[0]
    const variant =
      isRecord(hitDoc) && (typeof hitDoc.id === 'string' || typeof hitDoc.id === 'number')
        ? {
            id: hitDoc.id,
            filename: typeof hitDoc.filename === 'string' ? hitDoc.filename : null,
            url: typeof hitDoc.url === 'string' ? hitDoc.url : null,
            prefix: typeof hitDoc.prefix === 'string' ? hitDoc.prefix : null,
          }
        : undefined
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

export const generateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> => {
  const { payload, source: src, params: p, format, variantSlug, maxInputPixels, genFlight } = args
  const key = variantCacheKey(src, p, format)

  const generate = async (): Promise<GenBytes> => {
    const original = args.originalBytes ?? (await readOriginalCoalesced(args))
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
      if (err instanceof TransformOverloadError) return { ok: false, status: 503, msg: 'Server busy' }
      const hint = isSharpLoadError(err) ? ` — sharp failed to load; ${SHARP_INSTALL_HINT}` : ''
      payload.logger.error(`[payload-images] transform failed for ${src.id}: ${String(err)}${hint}`)
      return { ok: false, status: 500, msg: 'Transform failed' }
    }

    const persist = async (): Promise<void> => {
      try {
        await payload.create({
          collection: asSlug(variantSlug),
          file: { data: out.data, mimetype: out.mimeType, name: `${key}.${extForFormat(format)}`, size: out.data.byteLength },
          data: {
            source: src.id,
            cacheKey: key,
            fit: p.fit,
            format,
            quality: p.q,
            focalX: src.focalX ?? null,
            focalY: src.focalY ?? null,
          },
          overwriteExistingFiles: true,
        })
      } catch (err) {
        if (isForeignKeyError(err)) {
          payload.logger.info(`[payload-images] source ${src.id} was deleted before variant ${key} persisted — skipped.`)
        } else if (!isDuplicateKeyError(err)) {
          payload.logger.warn(`[payload-images] failed to persist variant ${key} for source ${src.id}: ${String(err)}`)
        }
      }
    }
    if (args.deferPersist === 'never') {
    } else if (args.deferPersist === false) {
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
