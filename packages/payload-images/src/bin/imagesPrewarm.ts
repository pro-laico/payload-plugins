/**
 * Payload custom-bin entry, registered as `payload images:prewarm` — bulk-warm every source
 * against the learned render profiles (+ config seeds).
 *
 *   payload images:prewarm                      # enqueue one imagesPrewarm job per source (your runner executes them)
 *   payload images:prewarm --now                # generate inline, no jobs runner needed
 *   payload images:prewarm --collection media   # an extendCollection target
 *   payload images:prewarm --limit 200          # cap sources processed this run
 *   payload images:prewarm --queue prewarm      # enqueue onto a specific queue
 */
import { getPayload, type SanitizedConfig } from 'payload'
import { asSlug } from '../lib/asSlug'

import { readPluginMarker } from '../lib/pluginMarker'
import { enqueuePrewarmJob } from '../lib/prewarm/enqueue'
import { prewarmSource } from '../lib/prewarm/prewarmSource'

export const script = async (config: SanitizedConfig): Promise<void> => {
  const argv = process.argv.slice(2)
  const now = argv.includes('--now')
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name)
    return i !== -1 ? argv[i + 1] : undefined
  }
  const marker = readPluginMarker(config)
  const prewarm = marker.prewarm
  if (!prewarm) {
    console.error('[payload-images] images:prewarm: the prewarm option is not enabled on imagesPlugin — nothing to do.')
    process.exit(1)
    return
  }
  const slug = asSlug(flag('--collection') ?? marker.sourceSlug ?? 'images')
  const queue = flag('--queue') ?? prewarm.queue
  const max = Number(flag('--limit')) || Number.POSITIVE_INFINITY

  const payload = await getPayload({ config })
  try {
    const deps = {
      sourceSlug: slug as string,
      variantSlug: marker.variantSlug ?? 'generated-images',
      profilesSlug: prewarm.profilesSlug,
      seeds: prewarm.seeds,
      formats: prewarm.formats,
      maxVariantsPerImage: prewarm.maxVariantsPerImage,
      constraints: prewarm.constraints,
    }
    let processed = 0
    let generated = 0
    let failed = 0
    let enqueued = 0

    let page = 1
    outer: for (;;) {
      const res = await payload.find({ collection: slug, limit: 50, page, depth: 0, overrideAccess: true, sort: 'id', select: {} })
      for (const doc of res.docs) {
        if (processed >= max) break outer
        processed++
        try {
          if (now) {
            const out = await prewarmSource(payload, doc.id, deps)
            generated += out.generated
            failed += out.failed
          } else {
            await enqueuePrewarmJob(payload, { sourceId: doc.id, reason: 'manual', taskSlug: prewarm.taskSlug, queue, waitUntil: false })
            enqueued++
          }
        } catch (err) {
          failed++
          payload.logger.warn(`[payload-images] images:prewarm: ${doc.id} failed: ${String(err)}`)
        }
      }
      if (!res.hasNextPage) break
      page++
    }

    payload.logger.info(
      now
        ? `[payload-images] images:prewarm '${slug}': ${generated} variant(s) generated, ${failed} failed (${processed} source(s)).`
        : `[payload-images] images:prewarm '${slug}': ${enqueued} job(s) enqueued on '${queue}' (${processed} source(s)) — run them with your jobs runner (payload.jobs.run / autorun).`,
    )
  } finally {
    await payload.db.destroy?.()
  }
  process.exit(0)
}
