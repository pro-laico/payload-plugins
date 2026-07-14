import type { BuiltModel } from './model'

export interface ValidateArgs {
  model: BuiltModel
  collectionSlugs: Set<string>
  globalSlugs: Set<string>
  fileCollections: Set<string>
  fieldNames?: Map<string, Set<string>>
}
