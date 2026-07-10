import { getPayload, type SanitizedConfig } from 'payload'

import { getServerSideURL } from '../lib/getServerSideURL'
import { analyzeImageMetadata } from '../blurhash/generate'
import { PLACEHOLDER_FIELD_NAMES } from '../blurhash/qualities'
import { readBytes, resolveStaticDir, type UploadDocLike } from '../transform/source'

/**
 * Payload custom-bin entry. `imagesPlugin` registers this under `config.bin` as the
 * `images:backfill` command, so `payload images:backfill` stamps the upload-time metadata
 * (placeholder tiers, palette, alpha flags) onto every image that predates the hook — the
 * one-time migration for existing projects. Reads run pure afterwards; new uploads are
 * hooked already.
 *
 *   payload images:backfill                    # only images missing metadata (idempotent)
 *   payload images:backfill --force            # regenerate every image
 *   payload images:backfill --focal            # also set the saliency focal on docs still at 50/50
 *   payload images:backfill --collection media # an extendCollection target
 *
 * `--focal` is opt-in because it CHANGES CROPS on a live site (busts caches, regenerates
 * variants) — everything else is additive metadata that alters no rendered pixels.
 */
export const script = async (config: SanitizedConfig): Promise<void> => {
  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const focal = argv.includes('--focal')
  const collectionIdx = argv.indexOf('--collection')
  const marker = (config.custom as { payloadImages?: { sourceSlug?: string } } | undefined)?.payloadImages //TODO: replace `as` cast with proper typing
  const slug = (collectionIdx !== -1 ? argv[collectionIdx + 1] : undefined) ?? marker?.sourceSlug ?? 'images'

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
      //TODO: replace `as never` cast with proper typing
      const res = await payload.find({ collection: slug as never, limit: 50, page, depth: 0, overrideAccess: true, sort: 'id' })
      for (const raw of res.docs) {
        const doc = raw as UploadDocLike & Record<string, unknown> & { id: string | number } //TODO: replace `as` cast with proper typing
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
            collection: slug as never, //TODO: replace `as` cast with proper typing
            id: doc.id,
            data: data as never, //TODO: replace `as` cast with proper typing
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
