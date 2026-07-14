import type { CollectionAfterChangeHook, CollectionSlug } from 'payload'

import { refId } from '../../lib/refs'
import { isNotFound } from '../../lib/isNotFound'
import { originalIdsFromDoc } from '../../lib/fontDoc'
import { readUploadBytes } from '../../lib/uploadBytes'
import type { Desired, OptimizeFromOriginalsOptions, Ref } from '../../types'
import { detectMetadata, isSubsetterLoadError, resolveCharsetText, subsetToWoff2 } from '../../lib/optimizeFont'

let warnedSubsetterLoad = false

const desiredFromDoc = (data: Record<string, unknown>): Desired[] => {
  const desired: Desired[] = []
  const variable = (data.variable ?? {}) as { upright?: Ref; italic?: Ref } //TODO: replace `as` cast with proper typing
  const uprightId = refId(variable.upright)
  const italicId = refId(variable.italic)
  if (uprightId != null) desired.push({ originalId: uprightId, style: 'normal', isVariable: true })
  if (italicId != null) desired.push({ originalId: italicId, style: 'italic', isVariable: true })
  if (uprightId == null && italicId == null) {
    const weights = Array.isArray(data.weights) ? data.weights : []
    for (const row of weights as Array<{ weight?: string; style?: string; file?: Ref }>) {
      //TODO: replace `as` cast with proper typing
      const fid = refId(row.file)
      if (fid != null)
        desired.push({ originalId: fid, style: row.style === 'italic' ? 'italic' : 'normal', isVariable: false, weight: row.weight })
    }
  }
  return desired
}

export const optimizeFromOriginalsHook = (opts: OptimizeFromOriginalsOptions = {}): CollectionAfterChangeHook => {
  const charsetText = resolveCharsetText(opts.charset)
  const originalSlug = (opts.originalSlug || 'fontOriginal') as CollectionSlug //TODO: replace `as` cast with proper typing
  const optimizedSlug = (opts.optimizedSlug || 'fontOptimized') as CollectionSlug //TODO: replace `as` cast with proper typing

  return async ({ doc, operation, previousDoc, req }) => {
    const data = doc as Record<string, unknown> //TODO: replace `as` cast with proper typing
    const desired = desiredFromDoc(data)
    const fontId = data.id as string | number //TODO: replace `as` cast with proper typing

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
      for (const d of existing.docs as unknown as Array<Record<string, unknown>>) {
        //TODO: replace `as` cast with proper typing
        const oid = refId(d.original as Ref) //TODO: replace `as` cast with proper typing
        if (oid != null) byOriginal.set(oid, d)
      }
      const desiredIds = new Set(desired.map((d) => d.originalId))
      const fontTitle = typeof data.title === 'string' && data.title ? data.title : String(fontId)

      for (const d of desired) {
        const current = byOriginal.get(d.originalId)
        if (current) {
          const weightDrift = !d.isVariable && d.weight && String(current.weight ?? '') !== d.weight
          if (weightDrift || String(current.style ?? '') !== d.style) {
            await req.payload.update({
              collection: optimizedSlug,
              id: current.id as string | number, //TODO: replace `as` cast with proper typing
              data: { weight: d.weight ?? current.weight, style: d.style } as never, //TODO: replace `as` cast with proper typing
              req,
            })
          }
          continue
        }
        let originalLabel = `original ${d.originalId}`
        try {
          const original = (await req.payload.findByID({
            collection: originalSlug,
            id: d.originalId,
            depth: 0,
            req,
          })) as { filename?: string | null; url?: string | null } //TODO: replace `as` cast with proper typing
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
            } as never, //TODO: replace `as` cast with proper typing
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
        try {
          await req.payload.delete({ collection: optimizedSlug, id: d.id as string | number, req }) //TODO: replace `as` cast with proper typing
        } catch (err) {
          if (!isNotFound(err)) req.payload.logger.warn({ msg: 'Could not delete stale optimized font', err })
        }
      }

      if (operation === 'update' && previousDoc) {
        const stillReferenced = new Set(originalIdsFromDoc(data))
        for (const oid of originalIdsFromDoc(previousDoc as Record<string, unknown>)) {
          //TODO: replace `as` cast with proper typing
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
