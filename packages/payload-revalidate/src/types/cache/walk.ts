export interface WalkOptions {
  maxDepth?: number
  maxTags?: number
}

export interface BakedEmbed {
  tag: string
  via: string
  kind: 'relationship' | 'upload' | 'join' | 'richText'
}

export interface WalkResult {
  tags: string[]
  embeds: BakedEmbed[]
  capped: boolean
}
