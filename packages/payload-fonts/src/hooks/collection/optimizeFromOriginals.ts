import type { CollectionAfterChangeHook, CollectionSlug } from 'payload'

import type { Desired, OptimizeFromOriginalsOptions, Ref } from '../../types'
import { originalIdsFromDoc } from '../../lib/fontDoc'
import { isNotFound } from '../../lib/isNotFound'
import { detectMetadata, isSubsetterLoadError, resolveCharsetText, subsetToWoff2 } from '../../lib/optimizeFont'
import { refId } from '../../lib/refs'
import { readUploadBytes } from '../../lib/uploadBytes'

// Surface the bundled-subsetter load failure (see isSubsetterLoadError) as ONE loud, actionable
// log instead of only the generic per-font warning.
let warnedSubsetterLoad = false

/** Read the font doc's slots into the set of originals to optimize. */
const desiredFromDoc = (data: Record<string, unknown>): Desired[] => {
  const desired: Desired[] = []
  const variable = (data.variable ?? {}) as { upright?: Ref; italic?: Ref }
  const uprightId = refId(variable.upright)
  const italicId = refId(variable.italic)
  if (uprightId != null) desired.push({ originalId: uprightId, style: 'normal', isVariable: true })
  if (italicId != null) desired.push({ originalId: italicId, style: 'italic', isVariable: true })
  // Variable and weights are mutually exclusive (enforced on the collection); only read the
  // weights array when no variable file is present.
  if (uprightId == null && italicId == null) {
    const weights = Array.isArray(data.weights) ? data.weights : []
    for (const row of weights as Array<{ weight?: string; style?: string; file?: Ref }>) {
      const fid = refId(row.file)
      if (fid != null)
        desired.push({ originalId: fid, style: row.style === 'italic' ? 'italic' : 'normal', isVariable: false, weight: row.weight })
    }
  }
  return desired
}

/**
 * `afterChange` for the `Font` typeface: reconcile its served `fontOptimized` files
 * against the `fontOriginal` files referenced in its slots.
 *
 * Keyed by source-original id: a newly-referenced original is fetched, subsetted to WOFF2
 * (variable weight range read from the `wght` axis; static weight/style from the row) and
 * created; an original that's gone has its optimized deleted; an unchanged original is kept
 * (only its weight/style metadata is synced if the row changed). Best-effort — a single bad
 * font logs a warning and is skipped, never failing the typeface save. Touches only
 * `fontOptimized`, so it can't re-trigger this hook.
 */
export const optimizeFromOriginalsHook = (opts: OptimizeFromOriginalsOptions = {}): CollectionAfterChangeHook => {
  const charsetText = resolveCharsetText(opts.charset)
  const originalSlug = (opts.originalSlug || 'fontOriginal') as CollectionSlug
  const optimizedSlug = (opts.optimizedSlug || 'fontOptimized') as CollectionSlug

  return async ({ doc, operation, previousDoc, req }) => {
    const data = doc as Record<string, unknown>
    const fontId = data.id as string | number
    const desired = desiredFromDoc(data)

    // Forward the request's auth so reading the original succeeds when it lives on cloud
    // storage served through Payload's own access-controlled file route — an unauthenticated
    // fetch 403s. `origin`/`referer` are required too: Payload's CSRF protection rejects a
    // cookie-authenticated request whose Origin isn't allow-listed.
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
        const oid = refId(d.original as Ref)
        if (oid != null) byOriginal.set(oid, d)
      }
      const desiredIds = new Set(desired.map((d) => d.originalId))
      const fontTitle = typeof data.title === 'string' && data.title ? data.title : String(fontId)

      // Create new, or sync metadata on a kept one whose row changed.
      for (const d of desired) {
        const current = byOriginal.get(d.originalId)
        if (current) {
          const weightDrift = !d.isVariable && d.weight && String(current.weight ?? '') !== d.weight
          if (weightDrift || String(current.style ?? '') !== d.style) {
            await req.payload.update({
              collection: optimizedSlug,
              id: current.id as string | number,
              data: { weight: d.weight ?? current.weight, style: d.style } as never,
              req,
            })
          }
          continue
        }
        // Upgraded to include the filename once the original doc is fetched — a bare id tells an
        // operator nothing about WHICH font file broke.
        let originalLabel = `original ${d.originalId}`
        try {
          const original = (await req.payload.findByID({
            collection: originalSlug,
            id: d.originalId,
            depth: 0,
            req,
          })) as {
            filename?: string | null
            url?: string | null
          }
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
          // Variable: the intrinsic axis range wins. Static: the row's weight wins, detection fills a blank.
          const weight = d.isVariable ? (meta?.weight ?? d.weight) : (d.weight ?? meta?.weight)
          // An upright variable file whose axes also cover italics (ital / negative slnt) is
          // flagged so the serving layers can emit an italic face from the same file.
          const italCapable = Boolean(d.style === 'normal' && meta?.italCapable)
          const baseName = (original.filename || `font-${d.originalId}`).replace(/\.[^.]+$/, '')
          // Shallow-cloned req: createLocalReq mutates `.file` on the req it's given; the clone
          // keeps that off the parent while sharing the transaction.
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
            } as never,
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

      // Delete optimized files whose source original is no longer referenced.
      for (const [oid, d] of byOriginal) {
        if (desiredIds.has(oid)) continue
        try {
          await req.payload.delete({ collection: optimizedSlug, id: d.id as string | number, req })
        } catch (err) {
          if (!isNotFound(err)) req.payload.logger.warn({ msg: 'Could not delete stale optimized font', err })
        }
      }

      // Delete originals this update de-referenced (a swapped/removed slot file). Originals
      // aren't shared (create-only slots), so this is always safe.
      if (operation === 'update' && previousDoc) {
        const stillReferenced = new Set(originalIdsFromDoc(data))
        for (const oid of originalIdsFromDoc(previousDoc as Record<string, unknown>)) {
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
