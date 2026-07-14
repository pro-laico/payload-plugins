import type { CollectionAfterChangeHook } from 'payload'

import { refId } from '../../lib/refs'
import { isRecord } from '../../lib/isRecord'
import { isNotFound } from '../../lib/isNotFound'
import { originalIdsFromDoc } from '../../lib/fontDoc'
import { readUploadBytes } from '../../lib/uploadBytes'
import type { Desired, OptimizeFromOriginalsOptions, UploadDoc } from '../../types'
import { detectMetadata, isSubsetterLoadError, resolveCharsetText, subsetToWoff2 } from '../../lib/optimizeFont'

let warnedSubsetterLoad = false

const idOf = (v: unknown): string | number | undefined =>
  isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number') ? v.id : undefined
const asUploadDoc = (v: unknown): v is UploadDoc => isRecord(v)

const desiredFromDoc = (data: Record<string, unknown>): Desired[] => {
  const desired: Desired[] = []
  const variable: Record<string, unknown> = isRecord(data.variable) ? data.variable : {}
  const uprightId = refId(variable.upright)
  const italicId = refId(variable.italic)
  if (uprightId != null) desired.push({ originalId: uprightId, style: 'normal', isVariable: true })
  if (italicId != null) desired.push({ originalId: italicId, style: 'italic', isVariable: true })
  if (uprightId == null && italicId == null) {
    for (const row of Array.isArray(data.weights) ? data.weights : []) {
      if (!isRecord(row)) continue
      const fid = refId(row.file)
      const weight = typeof row.weight === 'string' ? row.weight : undefined
      if (fid != null) desired.push({ originalId: fid, style: row.style === 'italic' ? 'italic' : 'normal', isVariable: false, weight })
    }
  }
  return desired
}

export const optimizeFromOriginalsHook = (opts: OptimizeFromOriginalsOptions = {}): CollectionAfterChangeHook => {
  const charsetText = resolveCharsetText(opts.charset)
  const originalSlug = opts.originalSlug || 'fontOriginal'
  const optimizedSlug = opts.optimizedSlug || 'fontOptimized'

  return async ({ doc, operation, previousDoc, req }) => {
    const data: Record<string, unknown> = isRecord(doc) ? doc : {}
    const desired = desiredFromDoc(data)
    const fontId = idOf(data)
    if (fontId == null) return doc

    const fwdHeaders: Record<string, string> = {}
    for (const h of ['cookie', 'authorization', 'origin', 'referer']) {
      const v = req.headers?.get(h)
      if (v) fwdHeaders[h] = v
    }

    try {
      const existing = await req.payload.find({
        collection: optimizedSlug,
        where: { font: { equals: fontId } },
        depth: 0,
        limit: 1000,
        req,
      })
      const byOriginal = new Map<string | number, Record<string, unknown>>()
      for (const d of existing.docs) {
        const oid = refId(d.original)
        if (oid != null) byOriginal.set(oid, d)
      }
      const desiredIds = new Set(desired.map((d) => d.originalId))
      const fontTitle = typeof data.title === 'string' && data.title ? data.title : String(fontId)

      for (const d of desired) {
        const current = byOriginal.get(d.originalId)
        if (current) {
          const weightDrift = !d.isVariable && d.weight && String(current.weight ?? '') !== d.weight
          const cid = idOf(current)
          if ((weightDrift || String(current.style ?? '') !== d.style) && cid != null) {
            await req.payload.update({
              collection: optimizedSlug,
              id: cid,
              data: { weight: d.weight ?? current.weight, style: d.style },
              req,
            })
          }
          continue
        }
        let originalLabel = `original ${d.originalId}`
        try {
          const originalRaw = await req.payload.findByID({ collection: originalSlug, id: d.originalId, depth: 0, req })
          const original: UploadDoc = asUploadDoc(originalRaw) ? originalRaw : {}
          if (original.filename) originalLabel = `original ${d.originalId} ('${original.filename}')`
          const bytes = await readUploadBytes(req.payload, originalSlug, original, { headers: fwdHeaders })
          if (!bytes) {
            req.payload.logger.warn(
              `[payload-fonts] typeface '${fontTitle}': could not read ${originalLabel} — the stored file is missing or unreadable, so that weight will NOT be served.`,
            )
            continue
          }
          const meta = await detectMetadata(bytes)
          const woff2 = await subsetToWoff2(bytes, charsetText)
          const weight = d.isVariable ? (meta?.weight ?? d.weight) : (d.weight ?? meta?.weight)
          const italCapable = Boolean(d.style === 'normal' && meta?.italCapable)
          const baseName = (original.filename || `font-${d.originalId}`).replace(/\.[^.]+$/, '')
          await req.payload.create({
            collection: optimizedSlug,
            req: { ...req },
            data: {
              font: fontId,
              original: d.originalId,
              weight,
              style: d.style,
              isVariable: meta?.isVariable ?? d.isVariable,
              italCapable,
              ...(italCapable && meta?.obliqueAngle ? { obliqueAngle: meta.obliqueAngle } : {}),
            },
            file: { data: woff2, name: `${baseName}.woff2`, mimetype: 'font/woff2', size: woff2.length },
          })
        } catch (err) {
          if (isSubsetterLoadError(err) && !warnedSubsetterLoad) {
            warnedSubsetterLoad = true
            req.payload.logger.error(
              "[payload-fonts] The font subsetter failed to LOAD (subset-font / harfbuzz wasm / fontkit) — uploaded fonts are NOT being subsetted, so no web fonts will be served. In Next.js the wasm/native deps were bundled: add `serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit']` to your next.config. Docs: https://payload-plugins.prolaico.com/docs/plugins/payload-fonts",
            )
          }
          req.payload.logger.warn({
            msg: `[payload-fonts] typeface '${fontTitle}': optimization failed for ${originalLabel} — the file may be corrupt or not a real font; that weight will NOT be served.`,
            err,
          })
        }
      }

      for (const [oid, d] of byOriginal) {
        if (desiredIds.has(oid)) continue
        const did = idOf(d)
        if (did == null) continue
        try {
          await req.payload.delete({ collection: optimizedSlug, id: did, req })
        } catch (err) {
          if (!isNotFound(err)) req.payload.logger.warn({ msg: 'Could not delete stale optimized font', err })
        }
      }

      if (operation === 'update' && previousDoc) {
        const stillReferenced = new Set(originalIdsFromDoc(data))
        for (const oid of originalIdsFromDoc(isRecord(previousDoc) ? previousDoc : {})) {
          if (stillReferenced.has(oid)) continue
          try {
            await req.payload.delete({ collection: originalSlug, id: oid, req })
          } catch (err) {
            if (!isNotFound(err)) req.payload.logger.warn({ msg: `Could not delete de-referenced font original ${oid}`, err })
          }
        }
      }
    } catch (err) {
      req.payload.logger.warn({ msg: 'Font optimize reconcile failed', err })
    }
    return doc
  }
}
