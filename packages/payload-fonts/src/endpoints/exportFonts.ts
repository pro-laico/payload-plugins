import { createHash, timingSafeEqual } from 'node:crypto'

import type { CollectionSlug, Endpoint, GlobalSlug } from 'payload'

import { refId } from '../lib/refs'
import { DEFAULT_FONT_ROLES } from '../lib/roles'
import { readUploadBytes } from '../lib/uploadBytes'

/** A role key — `sans`/`serif`/`mono`/`display` by default, but any string when customised. */
type Role = string
const DEFAULT_ROLE_KEYS: Role[] = DEFAULT_FONT_ROLES.map((r) => r.key)

export interface ExportFontsEndpointOptions {
  /** Mount path under the Payload API route. Default `/fonts/export` (→ `/api/fonts/export`). */
  path?: string
  /** Slug of the standalone font-selection global. Default `fontSet`. */
  fontSetGlobalSlug?: string
  /** Slug of the optimized (served) weight-file upload collection. Default `fontOptimized`. */
  fontOptimizedSlug?: string
  /** Role keys to resolve from the `fontSet` global. Default sans/serif/mono/display. */
  roles?: Role[]
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
  const {
    path: endpointPath = '/fonts/export',
    fontSetGlobalSlug = 'fontSet',
    fontOptimizedSlug = 'fontOptimized',
    roles = DEFAULT_ROLE_KEYS,
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
          depth: 0,
          overrideAccess: true,
          // `as unknown as` — in a project with generated types this resolves to the concrete
          // fontSet interface, which doesn't structurally overlap a string-keyed record.
        })) as unknown as FontSelection
        selection = Object.fromEntries(roles.map((role) => [role, fontSetGlobal?.[role]]))
      } catch {
        // no fontSet global in this project
      }

      const fonts: Partial<Record<Role, ExportedFont[]>> = {}
      if (selection) {
        // One typeface per role (tolerate a stray array — take the first); fetch every role's
        // served files in a single query grouped by typeface, rather than one round-trip per role.
        const roleIds = roles
          .map((role) => ({
            role,
            id: refId((Array.isArray(selection[role]) ? (selection[role] as TypefaceRef[])[0] : selection[role]) ?? null),
          }))
          .filter((r): r is { role: Role; id: string | number } => r.id != null)

        const docsByFont = new Map<string | number, Array<Record<string, unknown>>>()
        if (roleIds.length) {
          const uniqueIds = [...new Set(roleIds.map((r) => r.id))]
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
          } catch {
            // leave docsByFont empty — the response just carries no fonts
          }
        }

        for (const { role, id } of roleIds) {
          const exported: ExportedFont[] = []
          for (const doc of docsByFont.get(id) ?? []) {
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
