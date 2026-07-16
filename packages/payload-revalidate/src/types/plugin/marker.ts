import type { DependencyRule } from './dependencyRule'
import type { RevalidatePluginOptions } from './options'

export interface PayloadRevalidateMarker {
  options: RevalidatePluginOptions
  endpointPath: string | null
  prefix: string
  observe: boolean
  lists: Record<string, string[]>
  extraTags: Record<string, string[]>
  rules: DependencyRule[]
}
