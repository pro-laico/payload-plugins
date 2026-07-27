import { createHash, timingSafeEqual } from 'node:crypto'
import type { Endpoint } from 'payload'

import { isAllowed } from '../_kit'
import type { EndpointAccess } from '../_kit'
import { buildFontsExport } from '../lib/buildFontsExport'
import type { ExportFontsEndpointOptions } from '../types'

/** The default path. `plugin.ts` registers the endpoint here and reports the same value on the
 * marker, so the CLI and the docs can't drift from where it actually lives. */
export const FONTS_EXPORT_PATH = '/fonts/export'

function secretsMatch(provided: string, secret: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

/** The default gate: a timing-safe `Authorization: Bearer <PAYLOAD_SECRET>` check. This endpoint is
 * called by headless builds with no user session, so the default ignores `req.user` and inspects
 * the header instead — a consumer's `options.access.export` overrides it. */
const bearerSecretGate: EndpointAccess = (req) => {
  const secret = process.env.PAYLOAD_SECRET || ''
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return Boolean(secret && provided && secretsMatch(provided, secret))
}

/** Ships the active fonts' bytes to a build that can't reach the database — the remote case.
 * A build that CAN reach it should use `payload fonts:download`, which skips the HTTP round-trip
 * (and this auth) by reading the same data through the Local API. */
export const exportFontsEndpoint = (opts: ExportFontsEndpointOptions): Endpoint => {
  const { path: endpointPath, fontSetGlobalSlug, fontOptimizedSlug, families, access } = opts

  return {
    path: endpointPath,
    method: 'get',
    handler: async (req) => {
      if (!(await isAllowed(access, req, bearerSecretGate))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

      const manifest = await buildFontsExport(req.payload, { fontSetGlobalSlug, fontOptimizedSlug, families })
      return Response.json(manifest, { headers: { 'Cache-Control': 'no-store' } })
    },
  }
}
