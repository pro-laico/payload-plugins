import type { JoinMembership } from './joins'
import type { Tags } from '../cache/tagOptions'
import type { ChangeDetectionSchema } from './changeDetection'
import type { DependencyRule } from '../plugin/dependencyRule'
import type { CollectionSettings } from '../plugin/collectionConfig'

export interface CollectionHookInput {
  slug: string
  settings: CollectionSettings
  rules: DependencyRule[]
  tags: Tags
  observe: boolean
  diffSchema?: ChangeDetectionSchema
  joinRules?: JoinMembership[]
}

export type Lanes = 'both' | 'draft'

export interface RuleGate {
  changed: Set<string> | null
  membership: boolean
  docs?: { doc: unknown; previousDoc: unknown }
}
