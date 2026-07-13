/**
 * Payload custom-bin entry, registered as `payload images:backfill` — stamps the upload-time
 * metadata (placeholder tiers, palette, alpha flags) onto every image that predates the hook.
 *
 *   payload images:backfill                    # only images missing metadata (idempotent)
 *   payload images:backfill --force            # regenerate every image
 *   payload images:backfill --focal            # also set the saliency focal on docs still at 50/50
 *   payload images:backfill --collection media # an extendCollection target
 *
 * `--focal` is opt-in because it CHANGES CROPS on a live site (busts caches, regenerates
 * variants); everything else is additive metadata that alters no rendered pixels.
 */
import { getPayload, type SanitizedConfig } from 'payload'
import { asSlug } from '../lib/asSlug'

import { readPluginMarker } from '../lib/pluginMarker'
import { analyzeImageMetadata } from '../lib/metadata/analyze'
import { resolveStaticDir } from '../lib/transform/staticDir'
import { getServerSideURL } from '../lib/getServerSideURL'
import { PLACEHOLDER_FIELD_NAMES } from '../lib/placeholders/qualities'
import { readBytes } from '../lib/transform/source'
import type { UploadDocLike } from '../types'

export const script = async (config: SanitizedConfig): Promise<void> => {
  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const focal = argv.includes('--focal')
  const collectionIdx = argv.indexOf('--collection')
  const marker = readPluginMarker(config)
  const slug = asSlug((collectionIdx !== -1 ? argv[collectionIdx + 1] : undefined) ?? marker.sourceSlug ?? 'images')

  const payload = await getPayload({ config })
  try {
    const staticDir = resolveStaticDir(payload, slug)
    const base = payload.config.serverURL || getServerSideURL() || ''
    let failed = 0
    let stamped = 0
    let skipped = 0
    let processed = 0

    const hasAllMetadata = (doc: Record<string, unknown>): boolean =>
      PLACEHOLDER_FIELD_NAMES.every((f) => typeof doc[f] === 'string' && doc[f]) && doc.palette != null && typeof doc.hasAlpha === 'boolean'

    let page = 1
    for (;;) {
      const res = await payload.find({ collection: slug, limit: 50, page, depth: 0, overrideAccess: true, sort: 'id' })
      for (const raw of res.docs) {
        //EXCUSE: docs of a runtime-chosen collection are untyped; the shape is duck-checked field by field below
        const doc = raw as UploadDocLike & Record<string, unknown> & { id: string | number }
        processed++
        const wantsFocal = focal && doc.focalX === 50 && doc.focalY === 50
        if (!force && !wantsFocal && hasAllMetadata(doc)) {
          skipped++
          continue
        }
        try {
          const bytes = await readBytes(doc, staticDir, base, { payload, slug })
          if (!bytes) {
            failed++
            payload.logger.warn(`[payload-images] images:backfill: source ${doc.id} unreadable (filename=${doc.filename ?? 'none'}) — skipped`)
            continue
          }
          const analysis = await analyzeImageMetadata(bytes)
          const data: Record<string, unknown> = {
            ...analysis.placeholderFields,
            palette: analysis.palette,
            hasAlpha: analysis.hasAlpha,
            isOpaque: analysis.isOpaque,
          }
          const settingFocal = wantsFocal && analysis.attention != null
          if (settingFocal && analysis.attention) {
            data.focalX = analysis.attention.x
            data.focalY = analysis.attention.y
          }
          await payload.update({
            collection: slug,
            id: doc.id,
            data: data as never, //EXCUSE: data for a runtime-chosen collection can't satisfy the generated per-collection data type
            overrideAccess: true,
            ...(settingFocal ? {} : { context: { disableRevalidate: true } }),
          })
          stamped++
        } catch (err) {
          failed++
          payload.logger.warn(`[payload-images] images:backfill: ${doc.id} failed: ${String(err)}`)
        }
      }
      if (!res.hasNextPage) break
      page++
    }

    payload.logger.info(
      `[payload-images] images:backfill '${slug}': ${stamped} stamped, ${skipped} already current, ${failed} failed (${processed} total).`,
    )
  } finally {
    await payload.db.destroy?.()
  }
  process.exit(0)
}
