import { createHash, timingSafeEqual } from 'node:crypto'
import type { Endpoint } from 'payload'

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

/** Ships the active fonts' bytes to a build that can't reach the database — the remote case.
 * A build that CAN reach it should use `payload fonts:download`, which skips the HTTP round-trip
 * (and this auth) by reading the same data through the Local API. */
export const exportFontsEndpoint = (opts: ExportFontsEndpointOptions): Endpoint => {
  const { path: endpointPath, fontSetGlobalSlug, fontOptimizedSlug, families } = opts

  return {
    path: endpointPath,
    method: 'get',
    handler: async (req) => {
      const secret = process.env.PAYLOAD_SECRET || ''
      const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
      if (!secret || !provided || !secretsMatch(provided, secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

      const manifest = await buildFontsExport(req.payload, { fontSetGlobalSlug, fontOptimizedSlug, families })
      return Response.json(manifest, { headers: { 'Cache-Control': 'no-store' } })
    },
  }
}
