import { createHash, timingSafeEqual } from 'node:crypto'

import type { CollectionSlug, Endpoint, GlobalSlug } from 'payload'

import { refId } from '../lib/refs'
import { DEFAULT_FONT_FAMILIES } from '../lib/families'
import { readUploadBytes } from '../lib/uploadBytes'

/** A family key — `sans`/`serif`/`mono`/`display` by default, but any string when customised. */
type Family = string
const DEFAULT_FAMILY_KEYS: Family[] = DEFAULT_FONT_FAMILIES.map((r) => r.key)

export interface ExportFontsEndpointOptions {
  /** Mount path under the Payload API route. Default `/fonts/export` (→ `/api/fonts/export`). */
  path?: string
  /** Slug of the standalone font-selection global. Default `fontSet`. */
  fontSetGlobalSlug?: string
  /** Slug of the optimized (served) weight-file upload collection. Default `fontOptimized`. */
  fontOptimizedSlug?: string
  /** Family keys to resolve from the `fontSet` global. Default sans/serif/mono/display. */
  families?: Family[]
}

/** The selected typeface for a family: a populated `font` doc or its id. */
type TypefaceRef = { id?: string | number; title?: string | null } | string | number | null
type FontSelection = Partial<Record<Family, TypefaceRef | TypefaceRef[]>>

/** A single exported weight file: filename, extension, mime, base64 bytes, and (optional) weight/style. */
export type ExportedFont = {
  filename: string
  extension: string
  mimeType: string | null
  data: string
  weight?: string | null
  style?: string | null
}
/** Per-family debug info: is a typeface selected, how many optimized files it has, and how many of
 *  those couldn't be read from storage — so an empty export can name its cause per family. */
export type ExportFamilyDiagnostics = { selected: boolean; typeface?: string; optimizedFiles: number; readFailures: number }
/** JSON returned by the fonts export endpoint — an array of weight files per family.
 *  `diagnostics` is additive; older servers omit it. */
export type ExportFontsResponse = {
  fonts: Partial<Record<Family, ExportedFont[]>>
  diagnostics?: Partial<Record<Family, ExportFamilyDiagnostics>>
}

/**
 * Constant-time secret compare. Both sides are sha256-hashed to a fixed 32 bytes first, so the
 * comparison is constant-time regardless of length.
 */
function secretsMatch(provided: string, secret: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

/**
 * `GET /api/fonts/export`. Resolves the active fonts from the `fontSet` global — each family
 * points at ONE `font` typeface — and returns the bytes of that typeface's served
 * `fontOptimized` files so the `payload-fonts-download` CLI can write them for
 * `next/font/local`. Secured by the project's `PAYLOAD_SECRET` (Bearer).
 */
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

      // Compare against the RAW PAYLOAD_SECRET (what the caller sends).
      const secret = process.env.PAYLOAD_SECRET || ''
      const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
      if (!secret || !provided || !secretsMatch(provided, secret)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Read the active selection from the `fontSet` global. The shared secret is the trust
      // boundary → `overrideAccess: true`.
      let selection: FontSelection | undefined
      try {
        const fontSetGlobal = (await payload.findGlobal({
          slug: fontSetGlobalSlug as GlobalSlug,
          // depth 1 populates each slot's typeface (defaultPopulate: title/family), so the
          // diagnostics can name the selected typeface.
          depth: 1,
          overrideAccess: true,
          // `as unknown as` — in a project with generated types this resolves to the concrete
          // fontSet interface, which doesn't structurally overlap a string-keyed record.
        })) as unknown as FontSelection
        selection = Object.fromEntries(families.map((family) => [family, fontSetGlobal?.[family]]))
      } catch {
        // no fontSet global in this project
      }

      const fonts: Partial<Record<Family, ExportedFont[]>> = {}
      const diagnostics: Partial<Record<Family, ExportFamilyDiagnostics>> = Object.fromEntries(
        families.map((family) => [family, { selected: false, optimizedFiles: 0, readFailures: 0 }]),
      )
      if (selection) {
        // One typeface per family (tolerate a stray array — take the first); fetch every family's
        // served files in a single query grouped by typeface, rather than one round-trip per family.
        const familyIds = families
          .map((family) => {
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
              collection: fontOptimizedSlug as CollectionSlug,
              where: { font: { in: uniqueIds } },
              depth: 0,
              limit: 1000,
              overrideAccess: true,
            })
            for (const doc of res.docs as unknown as Array<Record<string, unknown>>) {
              const fontId = refId(doc.font)
              if (fontId == null) continue
              const bucket = docsByFont.get(fontId)
              if (bucket) bucket.push(doc)
              else docsByFont.set(fontId, [doc])
            }
          } catch (err) {
            // leave docsByFont empty — the response just carries no fonts
            payload.logger.warn({ msg: `[payload-fonts] export: could not query ${fontOptimizedSlug}`, err })
          }
        }

        for (const { family, id, title } of familyIds) {
          const docs = docsByFont.get(id) ?? []
          const diag = { selected: true, typeface: title, optimizedFiles: docs.length, readFailures: 0 }
          diagnostics[family] = diag
          const exported: ExportedFont[] = []
          for (const doc of docs) {
            const filename = typeof doc.filename === 'string' ? doc.filename : null
            const bytes = filename
              ? await readUploadBytes(payload, fontOptimizedSlug, doc as { filename?: string | null; url?: string | null })
              : null
            if (!filename || !bytes) {
              diag.readFailures++
              continue
            }
            exported.push({
              filename,
              extension: filename.split('.').pop()?.toLowerCase() || 'woff2',
              mimeType: (doc.mimeType as string) ?? null,
              data: bytes.toString('base64'),
              weight: (doc.weight as string) ?? null,
              style: (doc.style as string) ?? null,
            })
          }
          if (exported.length) fonts[family] = exported
        }
      }

      // no-store: the response carries font bytes behind auth.
      return Response.json({ fonts, diagnostics } satisfies ExportFontsResponse, { headers: { 'Cache-Control': 'no-store' } })
    },
  }
}
