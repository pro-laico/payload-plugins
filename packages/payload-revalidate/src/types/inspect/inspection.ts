import type { ScannedGetter } from '../scan/scan'
import type { ReferenceGraph } from '../graph/referenceGraph'
import type { DependencyRule } from '../plugin/dependencyRule'
import type { ObservedRead, RevalidateEvent } from '../observe/observe'

export interface InspectedCollection {
  idField: string | false
  lists: Record<string, string[]>
  extraTags: string[]
  fields: string[]
}

export interface RevalidateInspection {
  graph: ReferenceGraph
  prefix: string
  observing: boolean
  rules: DependencyRule[]
  settings: Record<string, InspectedCollection>
  getters: ScannedGetter[]
  reads: ObservedRead[]
  events: RevalidateEvent[]
}
