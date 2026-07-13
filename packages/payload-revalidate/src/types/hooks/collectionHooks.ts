import type { ChangeDetectionSchema } from './changeDetection'
import type { CollectionSettings } from '../options/collectionConfig'
import type { DependencyRule } from '../plugin/dependencyRule'
import type { JoinMembership } from './joins'

export interface CollectionHookInput {
  slug: string
  settings: CollectionSettings
  rules: DependencyRule[]
  /** Diff normalization derived from the collection's schema — see {@link ChangeDetectionSchema}. */
  diffSchema?: ChangeDetectionSchema
  /** Joins for which THIS collection is the child (member) side — a write here moves the
   *  parent's join membership. See {@link JoinMembership} and {@link joinMembershipBusts}. */
  joinRules?: JoinMembership[]
}

export type Lanes = 'both' | 'draft'

export interface RuleGate {
  changed: Set<string> | null
  /** Membership events fire `whenFields` rules unconditionally: the publish-time diff can't
   *  see edits that arrived through earlier draft saves (previousDoc IS the latest draft). */
  membership: boolean
  docs?: { doc: unknown; previousDoc: unknown }
}
