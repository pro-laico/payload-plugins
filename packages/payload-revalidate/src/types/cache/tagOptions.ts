export interface TagLaneOptions {
  draft?: boolean
}

export interface TagListOptions extends TagLaneOptions {
  scope?: string
}

export interface Tags {
  list: (slug: string, o?: TagListOptions) => string
  doc: (slug: string, id: string | number, o?: TagLaneOptions) => string
  join: (child: string, on: string, parentId: string | number, o?: TagLaneOptions) => string
  global: (slug: string, o?: TagLaneOptions) => string
  all: () => string
}
