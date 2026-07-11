export interface TagLaneOptions {
  /** Build the draft-lane variant (`…:draft`). @default false */
  draft?: boolean
}

export interface TagListOptions extends TagLaneOptions {
  /** A declared list scope (`posts:list:recent`) — busted on membership events and when
   *  the scope's declared fields change. Omit for the bare collection list tag. */
  scope?: string
}
