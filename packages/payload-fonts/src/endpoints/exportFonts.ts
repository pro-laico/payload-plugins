import { createHash, timingSafeEqual } from 'node:crypto'
import type { Endpoint } from 'payload'

import { buildFontsExport } from '../lib/buildFontsExport'
import { DEFAULT_FONT_FAMILIES } from '../lib/families'
import type { ExportFontsEndpointOptions, Family } from '../types'

const DEFAULT_FAMILY_KEYS: Family[] = DEFAULT_FONT_FAMILIES.map((r) => r.key)

function secretsMatch(provided: string, secret: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

/** Ships the active fonts' bytes to a build that can't reach the database — the remote case.
 * A build that CAN reach it should use `payload fonts:download`, which skips the HTTP round-trip
 * (and this auth) by reading the same data through the Local API. */
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
      const secret = process.env.PAYLOAD_SECRET || ''
      const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
      if (!secret || !provided || !secretsMatch(provided, secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

      const manifest = await buildFontsExport(req.payload, { fontSetGlobalSlug, fontOptimizedSlug, families })
      return Response.json(manifest, { headers: { 'Cache-Control': 'no-store' } })
    },
  }
}
