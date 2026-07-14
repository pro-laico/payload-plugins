import type { Field } from 'payload'

export type WithFields = { slug: string; fields: Field[] }

export interface SchemaIndex {
  collection(slug: string): WithFields | undefined
  global(slug: string): WithFields | undefined
  block(slug: string): WithFields | undefined
  locales?: string[]
}

export type IndexSource = {
  collections?: WithFields[]
  globals?: WithFields[]
  blocks?: WithFields[]
  localization?: false | { locales?: (string | { code: string })[] }
}
