import { getPayload, type Payload, type SanitizedConfig } from 'payload'

import { readFontsMarker } from '../lib/marker'
import { buildFontsExport } from '../lib/buildFontsExport'
import { writeFontsFromManifest } from '../scripts/downloadFonts'

/** `payload fonts:download` — the same job as the `payload-fonts-download` CLI, but reading the
 * database through the Local API instead of a running site's HTTP endpoint.
 *
 * That removes the awkward part of the build story: no FONT_DOWNLOAD_URL, no PAYLOAD_SECRET
 * round-trip, and nothing to be up and publicly reachable while `prebuild` runs. Payload's bin
 * runner hands us the resolved config, so `getPayload` here IS the process boot. Fonts on S3 still
 * work — the read goes through the collection's own storage handlers.
 *
 * Like the HTTP CLI, it never fails the build: a failure writes an empty definition and exits 0.
 * Erroring would make the first production deploy impossible — no database reachable (or no fonts
 * chosen yet) would fail the build, and a failed build is how you'd have gotten a site to choose
 * fonts on. */
export const script = async (config: SanitizedConfig): Promise<void> => {
  const marker = readFontsMarker(config)
  if (!marker) {
    console.error('[payload-fonts] fonts:download: the plugin is not registered on this config.')
    process.exitCode = 1
    return
  }

  let payload: Payload | undefined
  try {
    payload = await getPayload({ config })
    const manifest = await buildFontsExport(payload, {
      ...(marker.fontSetSlug ? { fontSetGlobalSlug: marker.fontSetSlug } : {}),
      fontOptimizedSlug: marker.fontOptimizedSlug,
      families: marker.familyKeys,
    })
    writeFontsFromManifest(manifest)
  } catch (err) {
    // Almost always the database: no DATABASE_URI on the build box, or it isn't reachable from
    // there. That's the case `payload-fonts-download` exists for — say so instead of dying.
    console.warn(`[payload-fonts] fonts:download could not read the fonts — wrote an empty definition so the build can proceed.`)
    console.warn(
      '[payload-fonts] It reads the database directly; if this build box has none, use the payload-fonts-download CLI against a running site.',
    )
    console.warn(err instanceof Error ? err.message : err)
    writeFontsFromManifest({ fonts: {}, diagnostics: {} })
  } finally {
    await payload?.db?.destroy?.()
  }
  process.exit(0)
}
