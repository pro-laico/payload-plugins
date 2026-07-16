import type { SeedPluginOptions } from './options'

export interface PayloadSeedMarker {
  options: SeedPluginOptions
  endpointPath: string
  assetsDir: string
}
