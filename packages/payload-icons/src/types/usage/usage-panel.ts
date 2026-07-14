import type { IconUsageManifest } from '../scan/usage-manifest'

export interface LiveRequest {
  name: string
  count: number
  lastRequestedAt: string | null
}

export interface IconUsagePanelClientProps {
  manifest: IconUsageManifest | null
  scanCommand: string
  liveRequests: LiveRequest[]
}
