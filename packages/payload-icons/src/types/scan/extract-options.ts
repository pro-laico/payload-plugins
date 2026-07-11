/** A single literal `<Icon name="…">` occurrence found in a file. */
export interface ExtractedUsage {
  /** The resolved literal icon name. */
  name: string
  /** 1-based line of the `name` value. */
  line: number
  /** 1-based column of the `name` value. */
  column: number
}

export interface ExtractOptions {
  /**
   * JSX tag names treated as icon usages. Matched exactly against the opening
   * tag name, so `Icon` matches `<Icon …>` but not `<MyIcon …>`.
   *
   * @default ['Icon']
   */
  components?: string[]
}
