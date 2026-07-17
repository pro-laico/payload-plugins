import type { Payload, UIFieldServerComponent } from 'payload'

import { pickUsageManifest } from '../../scan/pick'
import { scanIconUsagesLive } from '../../scan/live'
import { loadIconUsageManifest } from '../../scan/load'
import { iconRequestSlugOf } from '../../lib/marker'
import { IconUsagePanelClient } from './iconUsagePanel.client'
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
    const slug = iconRequestSlugOf(payload.config)
    if (!slug || !payload.collections?.[slug]) return []
    const res = await payload.find({
      collection: slug,
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
