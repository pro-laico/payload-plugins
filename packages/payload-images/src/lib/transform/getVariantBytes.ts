import { after } from 'next/server'

import { asSlug } from '../asSlug'
import { isRecord } from '../isRecord'
import { readBytes } from './source'
import { transformImage } from './sharp'
import { variantCacheKey } from './variantKey'
import { resolveStaticDir } from './staticDir'
import { TransformOverloadError } from './limit'
import { createSingleFlight } from './coalesce'
import { extForFormat, mimeForFormat } from './params'
import { isDuplicateKeyError, isForeignKeyError } from '../errors'
import type { GenBytes, GetVariantBytesArgs, TransformOutput, VariantBytes } from '../../types'

class SourceUnavailableError extends Error {
  constructor() {
    super('Source unavailable')
    this.name = 'SourceUnavailableError'
  }
}

// One process-wide generation single-flight, shared by the endpoint AND the prewarm job so the
// same not-yet-persisted key is never Sharp'd twice concurrently. Entries stay resident until the
// deferred persist lands (bounded by SETTLE_WAIT_MS), so requests arriving in the
// response-to-persist window reuse the bytes instead of re-transforming.
const SETTLE_WAIT_MS = 30_000
const defaultGenFlight = createSingleFlight<string, GenBytes>((v) =>
  v.ok && v.settled
    ? Promise.race([
        v.settled,
        new Promise<void>((resolve) => {
          setTimeout(resolve, SETTLE_WAIT_MS).unref?.()
        }),
      ])
    : undefined,
)

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
    // Passed as a provider so the read happens inside the transform gate: queued misses wait
    // without each holding a whole-original Buffer.
    const readOriginal = async (): Promise<Buffer> => {
      const original = args.originalBytes ?? (await readOriginalCoalesced(args))
      if (original) return original
      const relative = !!src.url && !/^https?:\/\//i.test(src.url)
      const hint = relative ? ' — relative-URL storage and the request origin did not resolve; set serverURL in buildConfig' : ''
      payload.logger.warn(`[payload-images] source ${src.id} unreadable (filename=${src.filename ?? 'none'}, url=${src.url ?? 'none'})${hint}`)
      throw new SourceUnavailableError()
    }

    let out: TransformOutput
    try {
      out = await transformImage(readOriginal, {
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
      if (err instanceof SourceUnavailableError) return { ok: false, status: 502, msg: 'Source unavailable' }
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
            // png ignores quality in both the encoder and the cache key — a stored number would
            // be whatever request happened to generate it and would skew fallback tie-breaking.
            quality: format === 'png' ? null : p.q,
            // Which render path produced these pixels (hotspot-windowed vs full-frame) — the
            // fallback picker must match it when focalSize zooms the crop.
            windowed: p.fit === 'cover' && p.h != null,
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
    let settled: Promise<void> | undefined
    if (args.deferPersist === 'never') {
    } else if (args.deferPersist === false) {
      await persist()
    } else {
      let resolveSettled = (): void => {}
      settled = new Promise<void>((resolve) => {
        resolveSettled = resolve
      })
      const run = (): Promise<void> => persist().finally(resolveSettled)
      try {
        after(run)
      } catch {
        void run()
      }
    }

    return { ok: true, data: out.data, mimeType: out.mimeType, ...(settled ? { settled } : {}) }
  }

  const result = await (genFlight ?? defaultGenFlight)(key, generate)
  return result.ok
    ? { ok: true, data: result.data, mimeType: result.mimeType, key }
    : { ok: false, status: result.status, msg: result.msg, key }
}

export const getOrCreateVariantBytes = async (args: GetVariantBytesArgs): Promise<VariantBytes> =>
  (await getCachedVariantBytes(args)) ?? generateVariantBytes(args)
