import type { Access, CollectionConfig, Field } from 'payload'

export interface IconAccess {
  read?: Access
  create?: Access
  update?: Access
  delete?: Access
}

export interface IconCollectionOverrides {
  slug?: string
  adminGroup?: string
  access?: IconAccess
  fields?: Field[]
  hooks?: CollectionConfig['hooks']
  upload?: Exclude<CollectionConfig['upload'], boolean>
}
