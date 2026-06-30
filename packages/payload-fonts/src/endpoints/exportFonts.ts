import { createHash, timingSafeEqual } from 'node:crypto'

import type { CollectionSlug, Endpoint, GlobalSlug } from 'payload'

import { readUploadBytes } from '../lib/uploadBytes'

type Role = 'sans' | 'serif' | 'mono' | 'display'
const ROLES: Role[] = ['sans', 'serif', 'mono', 'display']

export interface ExportFontsEndpointOptions {
  /** Mount path under the Payload API route. Default `/fonts/export` (→ `/api/fonts/export`). */
  path?: string
  /** Slug of the standalone font-selection global. Default `fontSet`. */
  fontSetGlobalSlug?: string
  /** Slug of the optimized (served) weight-file upload collection. Default `fontOptimized`. */
  fontOptimizedSlug?: string
}

/** The selected typeface for a role: a populated `font` doc or its id. */
type TypefaceRef = { id?: string | number } | string | number | null
type FontSelection = Partial<Record<Role, TypefaceRef | TypefaceRef[]>>

/** A single exported weight file: filename, extension, mime, base64 bytes, and (optional) weight/style. */
export type ExportedFont = {
  filename: string
  extension: string
  mimeType: string | null
  data: string
  weight?: string | null
  style?: string | null
}
/** JSON returned by the fonts export endpoint — an array of weight files per role. */
export type ExportFontsResponse = { fonts: Partial<Record<Role, ExportedFont[]>> }

const refId = (r: TypefaceRef): string | number | undefined => (r && typeof r === 'object' ? r.id : (r ?? undefined)) ?? undefined

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
 * `GET /api/fonts/export`. Resolves the active fonts from the `fontSet` global — each role
 * points at ONE `font` typeface — and returns the bytes of that typeface's served
 * `fontOptimized` files so the `payload-fonts-download` CLI can write them for
 * `next/font/local`. Secured by the project's `PAYLOAD_SECRET` (Bearer).
 */
export const exportFontsEndpoint = (opts: ExportFontsEndpointOptions = {}): Endpoint => {
  const { path: endpointPath = '/fonts/export', fontSetGlobalSlug = 'fontSet', fontOptimizedSlug = 'fontOptimized' } = opts

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
          depth: 0,
          overrideAccess: true,
        })) as FontSelection
        selection = { sans: fontSetGlobal?.sans, serif: fontSetGlobal?.serif, mono: fontSetGlobal?.mono, display: fontSetGlobal?.display }
      } catch {
        // no fontSet global in this project
      }

      const fonts: Partial<Record<Role, ExportedFont[]>> = {}
      if (selection) {
        for (const role of ROLES) {
          const ref = selection[role]
          // One typeface per role (tolerate a stray array — take the first).
          const typefaceId = refId((Array.isArray(ref) ? ref[0] : ref) ?? null)
          if (typefaceId == null) continue

          let optimized: Array<Record<string, unknown>> = []
          try {
            const res = await payload.find({
              collection: fontOptimizedSlug as CollectionSlug,
              where: { font: { equals: typefaceId } },
              depth: 0,
              limit: 1000,
              overrideAccess: true,
            })
            optimized = res.docs as unknown as Array<Record<string, unknown>>
          } catch {
            continue
          }

          const exported: ExportedFont[] = []
          for (const doc of optimized) {
            const filename = typeof doc.filename === 'string' ? doc.filename : null
            if (!filename) continue
            const bytes = await readUploadBytes(payload, fontOptimizedSlug, doc as { filename?: string | null; url?: string | null })
            if (!bytes) continue
            exported.push({
              filename,
              extension: filename.split('.').pop()?.toLowerCase() || 'woff2',
              mimeType: (doc.mimeType as string) ?? null,
              data: bytes.toString('base64'),
              weight: (doc.weight as string) ?? null,
              style: (doc.style as string) ?? null,
            })
          }
          if (exported.length) fonts[role] = exported
        }
      }

      // no-store: the response carries font bytes behind auth.
      return Response.json({ fonts } satisfies ExportFontsResponse, { headers: { 'Cache-Control': 'no-store' } })
    },
  }
}
