import type { Payload } from 'payload'

import { refId } from './refs'
import { isRecord } from '../_kit'
import { readUploadBytes } from './uploadBytes'
import type { ExportedFont, ExportFamilyDiagnostics, ExportFontsResponse, Family } from '../types'

export interface BuildFontsExportOptions {
  /** The resolved `fontSet` slug, or `null` when the app opted the global out — nothing is active
   * without it, so the export is empty by definition rather than by a failed lookup. */
  fontSetGlobalSlug: string | null
  fontOptimizedSlug: string
  families: Family[]
}

/** Resolves the active fonts into transferable bytes: the fontSet global → the selected typefaces →
 * their optimized files, read through whatever storage adapter the collection uses.
 *
 * Takes a `payload` handle rather than a request, so both callers share one implementation: the
 * HTTP export endpoint (a build box hitting a running site) and the `payload fonts:download` bin
 * (the build booting Payload against the DB itself, no server needed). */
export const buildFontsExport = async (payload: Payload, opts: BuildFontsExportOptions): Promise<ExportFontsResponse> => {
  const { fontSetGlobalSlug, fontOptimizedSlug, families } = opts

  let selection: Record<string, unknown> | undefined
  if (fontSetGlobalSlug) {
    try {
      const fontSetGlobal = await payload.findGlobal({ slug: fontSetGlobalSlug, depth: 1 })
      selection = Object.fromEntries(families.map((family) => [family, isRecord(fontSetGlobal) ? fontSetGlobal[family] : undefined]))
    } catch {}
  }

  const fonts: Partial<Record<Family, ExportedFont[]>> = {}
  const diagnostics: Partial<Record<Family, ExportFamilyDiagnostics>> = Object.fromEntries(
    families.map((family) => [family, { selected: false, optimizedFiles: 0, readFailures: 0 }]),
  )
  if (!selection) return { fonts, diagnostics }

  const familyIds = families
    .map((family) => {
      const raw = selection[family]
      const ref = (Array.isArray(raw) ? raw[0] : raw) ?? null
      const title = isRecord(ref) && typeof ref.title === 'string' ? ref.title : undefined
      return { family, id: refId(ref), title }
    })
    .filter((r): r is { family: Family; id: string | number; title: string | undefined } => r.id != null)

  const docsByFont = new Map<string | number, Array<Record<string, unknown>>>()
  if (familyIds.length) {
    const uniqueIds = [...new Set(familyIds.map((r) => r.id))]
    try {
      const res = await payload.find({ collection: fontOptimizedSlug, where: { font: { in: uniqueIds } }, depth: 0, limit: 1000 })
      for (const doc of res.docs) {
        const fontId = refId(doc.font)
        if (fontId == null) continue
        const bucket = docsByFont.get(fontId)
        if (bucket) bucket.push(doc)
        else docsByFont.set(fontId, [doc])
      }
    } catch (err) {
      payload.logger.warn({ msg: `[payload-fonts] export: could not query ${fontOptimizedSlug}`, err })
    }
  }

  for (const { family, id, title } of familyIds) {
    const docs = docsByFont.get(id) ?? []
    const diag = { selected: true, typeface: title, optimizedFiles: docs.length, readFailures: 0 }
    diagnostics[family] = diag
    const hasExplicitItalic = docs.some((doc) => doc.style === 'italic')
    const exported: ExportedFont[] = []
    for (const doc of docs) {
      const filename = typeof doc.filename === 'string' ? doc.filename : null
      const bytes = filename ? await readUploadBytes(payload, fontOptimizedSlug, isRecord(doc) ? doc : {}) : null
      if (!filename || !bytes) {
        diag.readFailures++
        continue
      }
      const entry: ExportedFont = {
        filename,
        extension: filename.split('.').pop()?.toLowerCase() || 'woff2',
        mimeType: typeof doc.mimeType === 'string' ? doc.mimeType : null,
        data: bytes.toString('base64'),
        weight: typeof doc.weight === 'string' ? doc.weight : null,
        style: typeof doc.style === 'string' ? doc.style : null,
      }
      exported.push(entry)
      if (doc.style !== 'italic' && doc.italCapable && !hasExplicitItalic) {
        exported.push({ ...entry, style: 'italic', obliqueAngle: typeof doc.obliqueAngle === 'number' ? doc.obliqueAngle : null })
      }
    }
    if (exported.length) fonts[family] = exported
  }

  return { fonts, diagnostics }
}
