import type { MuxVideoPluginOptions } from './options'

export interface PayloadMuxMarker {
  options: MuxVideoPluginOptions
  muxVideoSlug: string
  uploadPath: string
  webhookPath: string
}
