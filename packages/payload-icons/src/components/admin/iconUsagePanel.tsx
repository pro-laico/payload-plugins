import 'server-only'

import type { CollectionSlug, UIFieldServerComponent } from 'payload'

import { ICON_REQUEST_SLUG } from '../../collections/IconRequest'
import { getPayloadClient } from '../../lib/getPayloadClient'
import { loadIconUsageManifest } from '../../scan/load'
import { IconUsagePanelClient, type LiveRequest } from './iconUsagePanel.client'

/** Default scan command surfaced in the panel's empty state. */
const DEFAULT_SCAN_COMMAND = 'npx payload-icons-scan'

/**
 * Loads runtime icon misses from the `iconRequest` collection. Returns `[]`
 * when tracking isn't enabled (collection absent) or on any error — the panel
 * degrades to the static-only view.
 */
const loadLiveRequests = async (): Promise<LiveRequest[]> => {
  try {
    const payload = await getPayloadClient()
    if (!(payload.collections as Record<string, unknown>)?.[ICON_REQUEST_SLUG]) return []
    const res = await payload.find({
      collection: ICON_REQUEST_SLUG as CollectionSlug,
      limit: 500,
      depth: 0,
      sort: '-count',
      overrideAccess: true,
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
 * Server `UIField` for the IconSet edit view. Reads the build-time usage
 * manifest from disk (server-only — no `fs` reaches the client bundle) and the
 * runtime misses from the `iconRequest` collection, then hands both to
 * {@link IconUsagePanelClient}, which diffs them live against the set's
 * `iconsArray`.
 *
 * The manifest path and the displayed scan command come from the field's
 * `serverProps` (wired by `createIconSetCollection` / `iconsPlugin`); both fall
 * back to sensible defaults, so a bare registration still works.
 */
export const IconUsagePanel: UIFieldServerComponent = async (props) => {
  const serverProps = props as { manifestPath?: string; scanCommand?: string }
  const manifest = loadIconUsageManifest(serverProps.manifestPath)
  const liveRequests = await loadLiveRequests()
  return <IconUsagePanelClient manifest={manifest} scanCommand={serverProps.scanCommand ?? DEFAULT_SCAN_COMMAND} liveRequests={liveRequests} />
}

export default IconUsagePanel
