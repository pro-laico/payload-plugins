import type { CollectionSlug, Payload, UIFieldServerComponent } from 'payload'

import { scanIconUsagesLive } from '../../scan/live'
import { loadIconUsageManifest } from '../../scan/load'
import { IconUsagePanelClient } from './iconUsagePanel.client'
import { ICON_REQUEST_SLUG } from '../../collections/IconRequest'
import type { IconUsageManifest, LiveRequest } from '../../types'

import 'server-only'

const DEFAULT_SCAN_COMMAND = 'npx payload-icons-scan'

const getManifest = (manifestPath?: string): IconUsageManifest | null => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      return scanIconUsagesLive()
    } catch {}
  }
  return loadIconUsageManifest(manifestPath)
}

const loadLiveRequests = async (payload: Payload): Promise<LiveRequest[]> => {
  try {
    if (!(payload.collections as Record<string, unknown>)?.[ICON_REQUEST_SLUG]) return [] //TODO: replace `as` cast with proper typing
    const res = await payload.find({
      collection: ICON_REQUEST_SLUG as CollectionSlug, //TODO: replace `as` cast with proper typing
      limit: 500,
      depth: 0,
      sort: '-count',
    })
    return res.docs.map((d) => {
      const r = d as { name?: string; count?: number | null; lastRequestedAt?: string | null } //TODO: replace `as` cast with proper typing
      return { name: r.name ?? '', count: r.count ?? 0, lastRequestedAt: r.lastRequestedAt ?? null }
    })
  } catch {
    return []
  }
}

export const IconUsagePanel: UIFieldServerComponent = async ({ payload }) => {
  const manifest = getManifest()
  const liveRequests = await loadLiveRequests(payload)
  return <IconUsagePanelClient manifest={manifest} scanCommand={DEFAULT_SCAN_COMMAND} liveRequests={liveRequests} />
}

export default IconUsagePanel
