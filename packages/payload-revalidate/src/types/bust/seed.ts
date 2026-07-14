import type { Tags } from '../cache/tagOptions'
import type { DependencyRule } from '../plugin/dependencyRule'

export interface SeedResultLike {
  created: Record<string, number>
  collections?: string[]
  globals?: string[]
}

export interface SeedFlushState {
  tags: Tags
  lists: Record<string, string[]>
  extraTags: Record<string, string[]>
  rules: DependencyRule[]
  observe: boolean
}
