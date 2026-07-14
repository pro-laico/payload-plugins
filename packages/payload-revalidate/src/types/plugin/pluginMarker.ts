import type { DependencyRule } from './dependencyRule'
import type { RevalidatePluginOptions } from './pluginOptions'

export interface PayloadRevalidateMarker {
  options: RevalidatePluginOptions
  endpointPath: string | null
  prefix: string
  observe: boolean
  lists: Record<string, string[]>
  extraTags: Record<string, string[]>
  rules: DependencyRule[]
}
