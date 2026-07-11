export interface ResolveContext {
  /** `collection:_key` → created doc id. */
  docs: Map<string, string | number>
  /** For error messages. */
  where: string
}
