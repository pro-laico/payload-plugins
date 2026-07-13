export interface TagLaneOptions {
  /** Build the draft-lane variant (`…:draft`). @default false */
  draft?: boolean
}

export interface TagListOptions extends TagLaneOptions {
  /** A declared list scope (`posts:list:recent`) — busted on membership events and when
   *  the scope's declared fields change. Omit for the bare collection list tag. */
  scope?: string
}

/** The tag builders bound to one prefix — built by `createTags`, threaded through the
 *  hooks by the plugin factory and resolved per read by the `./cache` helpers. */
export interface Tags {
  list: (slug: string, o?: TagListOptions) => string
  doc: (slug: string, id: string | number, o?: TagLaneOptions) => string
  join: (child: string, on: string, parentId: string | number, o?: TagLaneOptions) => string
  global: (slug: string, o?: TagLaneOptions) => string
  all: () => string
}
