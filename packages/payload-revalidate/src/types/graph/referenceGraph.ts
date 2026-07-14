import type { Block, CollectionConfig, Field, GlobalConfig } from 'payload'

export interface ReferenceEdge {
  from: string
  to: string
  via: string
  kind: 'relationship' | 'upload' | 'join' | 'richText'
  polymorphic?: boolean
  on?: string
}

export interface ReferenceGraph {
  collections: string[]
  globals: string[]
  edges: ReferenceEdge[]
}

export type GraphSource = {
  collections?: CollectionConfig[] | { slug: string; fields: Field[] }[]
  globals?: GlobalConfig[] | { slug: string; fields: Field[] }[]
  blocks?: Block[]
}
