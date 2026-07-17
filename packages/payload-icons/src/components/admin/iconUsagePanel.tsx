import type { Payload, UIFieldServerComponent } from 'payload'

import { pickUsageManifest } from '../../scan/pick'
import { scanIconUsagesLive } from '../../scan/live'
import { loadIconUsageManifest } from '../../scan/load'
import { IconUsagePanelClient } from './iconUsagePanel.client'
import { ICON_REQUEST_SLUG } from '../../collections/IconRequest'
import type { IconUsageManifest, LiveRequest } from '../../types'

import 'server-only'

const DEFAULT_SCAN_COMMAND = 'npx payload-icons-scan'

const liveScan = (): IconUsageManifest | null => {
  if (process.env.NODE_ENV === 'production') return null
  try {
    return scanIconUsagesLive()
  } catch {
    return null
  }
}

const getManifest = (manifestPath?: string): IconUsageManifest | null => pickUsageManifest(liveScan(), loadIconUsageManifest(manifestPath))

const loadLiveRequests = async (payload: Payload): Promise<LiveRequest[]> => {
  try {
    if (!payload.collections?.[ICON_REQUEST_SLUG]) return []
    const res = await payload.find({
      collection: ICON_REQUEST_SLUG,
      limit: 500,
      depth: 0,
      sort: '-count',
    })
    return res.docs.map((d) => ({
      name: typeof d.name === 'string' ? d.name : '',
      count: typeof d.count === 'number' ? d.count : 0,
      lastRequestedAt: typeof d.lastRequestedAt === 'string' ? d.lastRequestedAt : null,
    }))
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
