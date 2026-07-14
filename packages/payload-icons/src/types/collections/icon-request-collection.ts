import type { CollectionConfig, Field } from 'payload'

export interface IconRequestCollectionOverrides {
  group?: string
  fields?: Field[]
  hooks?: CollectionConfig['hooks']
}
