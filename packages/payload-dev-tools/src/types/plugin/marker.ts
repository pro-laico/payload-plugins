import type { DevRegion } from '../region'
import type { DevToolsPluginOptions } from './options'

export interface PayloadDevToolsMarker {
  options: DevToolsPluginOptions
  devRoute: string
  regions: DevRegion[]
}
