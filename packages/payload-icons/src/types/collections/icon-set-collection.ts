import type { CollectionConfig, Field, PayloadRequest } from 'payload'

export interface IconSetCollectionOverrides {
  slug?: string
  livePreviewUrl?: (args: { data: Record<string, unknown>; req: PayloadRequest }) => string | Promise<string>
  group?: string
  hooks?: CollectionConfig['hooks']
  fields?: Field[]
  iconRowFields?: Field[]
  drafts?: boolean
}
