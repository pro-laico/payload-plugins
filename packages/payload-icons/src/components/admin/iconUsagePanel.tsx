import 'server-only'

import type { CollectionSlug, Payload, UIFieldServerComponent } from 'payload'

import { ICON_REQUEST_SLUG } from '../../collections/IconRequest'
import { loadIconUsageManifest } from '../../scan/load'
import { scanIconUsagesLive } from '../../scan/live'
import type { IconUsageManifest, LiveRequest } from '../../types'
import { IconUsagePanelClient } from './iconUsagePanel.client'

/** Default scan command surfaced in the panel's empty state (production, no manifest). */
const DEFAULT_SCAN_COMMAND = 'npx payload-icons-scan'

/**
 * The usage manifest for the panel. In **development** the source is on disk, so
 * scan it live — no build step / CLI / manifest file needed to see what the code
 * requests. In **production** the source isn't on disk at runtime, so read the
 * manifest the CLI wrote at build time.
 */
const getManifest = (manifestPath?: string): IconUsageManifest | null => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      return scanIconUsagesLive()
    } catch {
      // Fall through to the file if the live scan can't run for any reason.
    }
  }
  return loadIconUsageManifest(manifestPath)
}

/**
 * Loads runtime icon misses from the `iconRequest` collection. Returns `[]`
 * when tracking isn't enabled (collection absent) or on any error — the panel
 * degrades to the static-only view.
 */
const loadLiveRequests = async (payload: Payload): Promise<LiveRequest[]> => {
  try {
    if (!(payload.collections as Record<string, unknown>)?.[ICON_REQUEST_SLUG]) return []
    const res = await payload.find({
      collection: ICON_REQUEST_SLUG as CollectionSlug,
      limit: 500,
      depth: 0,
      sort: '-count',
    })
    return res.docs.map((d) => {
      const r = d as { name?: string; count?: number | null; lastRequestedAt?: string | null }
      return { name: r.name ?? '', count: r.count ?? 0, lastRequestedAt: r.lastRequestedAt ?? null }
    })
  } catch {
    return []
  }
}

/**
 * Server `UIField` for the IconSet edit view. Gets the usage manifest (live scan
 * in dev, CLI-written file in prod — see {@link getManifest}) plus the runtime
 * misses from the `iconRequest` collection — read through the `payload` instance
 * Payload injects into admin server components — and hands both to
 * {@link IconUsagePanelClient}, which diffs them against the set's `iconsArray`.
 * Server-only, so no `fs` reaches the client bundle.
 */
export const IconUsagePanel: UIFieldServerComponent = async ({ payload }) => {
  const manifest = getManifest()
  const liveRequests = await loadLiveRequests(payload)
  return <IconUsagePanelClient manifest={manifest} scanCommand={DEFAULT_SCAN_COMMAND} liveRequests={liveRequests} />
}

export default IconUsagePanel
