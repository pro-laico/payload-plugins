import { createHash, timingSafeEqual } from 'node:crypto'
import type { CollectionSlug, Endpoint, GlobalSlug } from 'payload'

import { refId } from '../lib/refs'
import { readUploadBytes } from '../lib/uploadBytes'
import { DEFAULT_FONT_FAMILIES } from '../lib/families'
import type {
  ExportedFont,
  ExportFamilyDiagnostics,
  ExportFontsEndpointOptions,
  ExportFontsResponse,
  Family,
  FontSelection,
  TypefaceRef,
} from '../types'

const DEFAULT_FAMILY_KEYS: Family[] = DEFAULT_FONT_FAMILIES.map((r) => r.key)

function secretsMatch(provided: string, secret: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

export const exportFontsEndpoint = (opts: ExportFontsEndpointOptions = {}): Endpoint => {
  const {
    path: endpointPath = '/fonts/export',
    fontSetGlobalSlug = 'fontSet',
    fontOptimizedSlug = 'fontOptimized',
    families = DEFAULT_FAMILY_KEYS,
  } = opts

  return {
    path: endpointPath,
    method: 'get',
    handler: async (req) => {
      const { payload } = req

      const secret = process.env.PAYLOAD_SECRET || ''
      const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
      if (!secret || !provided || !secretsMatch(provided, secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

      let selection: FontSelection | undefined
      try {
        const fontSetGlobal = (await payload.findGlobal({
          slug: fontSetGlobalSlug as GlobalSlug, //TODO: replace `as` cast with proper typing
          depth: 1,
        })) as unknown as FontSelection //TODO: replace `as` cast with proper typing
        selection = Object.fromEntries(families.map((family) => [family, fontSetGlobal?.[family]]))
      } catch {}

      const fonts: Partial<Record<Family, ExportedFont[]>> = {}
      const diagnostics: Partial<Record<Family, ExportFamilyDiagnostics>> = Object.fromEntries(
        families.map((family) => [family, { selected: false, optimizedFiles: 0, readFailures: 0 }]),
      )
      if (selection) {
        const familyIds = families
          .map((family) => {
            //TODO: replace `as` cast with proper typing
            const ref = (Array.isArray(selection[family]) ? (selection[family] as TypefaceRef[])[0] : selection[family]) ?? null
            const title = ref && typeof ref === 'object' && typeof ref.title === 'string' ? ref.title : undefined
            return { family, id: refId(ref), title }
          })
          .filter((r): r is { family: Family; id: string | number; title: string | undefined } => r.id != null)

        const docsByFont = new Map<string | number, Array<Record<string, unknown>>>()
        if (familyIds.length) {
          const uniqueIds = [...new Set(familyIds.map((r) => r.id))]
          try {
            const res = await payload.find({
              collection: fontOptimizedSlug as CollectionSlug, //TODO: replace `as` cast with proper typing
              where: { font: { in: uniqueIds } },
              depth: 0,
              limit: 1000,
            })
            for (const doc of res.docs as unknown as Array<Record<string, unknown>>) {
              //TODO: replace `as` cast with proper typing
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
            //TODO: replace `as` cast with proper typing
            const bytes = filename
              ? await readUploadBytes(payload, fontOptimizedSlug, doc as { filename?: string | null; url?: string | null })
              : null
            if (!filename || !bytes) {
              diag.readFailures++
              continue
            }
            const entry: ExportedFont = {
              filename,
              extension: filename.split('.').pop()?.toLowerCase() || 'woff2',
              mimeType: (doc.mimeType as string) ?? null, //TODO: replace `as` cast with proper typing
              data: bytes.toString('base64'),
              weight: (doc.weight as string) ?? null, //TODO: replace `as` cast with proper typing
              style: (doc.style as string) ?? null, //TODO: replace `as` cast with proper typing
            }
            exported.push(entry)
            if (doc.style !== 'italic' && doc.italCapable && !hasExplicitItalic) {
              exported.push({ ...entry, style: 'italic', obliqueAngle: typeof doc.obliqueAngle === 'number' ? doc.obliqueAngle : null })
            }
          }
          if (exported.length) fonts[family] = exported
        }
      }

      return Response.json({ fonts, diagnostics } satisfies ExportFontsResponse, { headers: { 'Cache-Control': 'no-store' } })
    },
  }
}
