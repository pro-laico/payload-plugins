import type { Field } from 'payload'

export type WithFields = { slug: string; fields: Field[] }

/** Schema lookup the walk resolves collections/globals/blocks through — see {@link indexSchema}. */
export interface SchemaIndex {
  collection(slug: string): WithFields | undefined
  global(slug: string): WithFields | undefined
  block(slug: string): WithFields | undefined
  /** Configured locale codes — lets the walk recognize a `locale: 'all'` map on a localized
   *  GROUP or named tab (whose single-locale value is an arbitrary object, indistinguishable
   *  from a locale map by shape alone). Empty/absent when the app isn't localized. */
  locales?: string[]
}

export type IndexSource = {
  collections?: WithFields[]
  globals?: WithFields[]
  blocks?: WithFields[]
  localization?: false | { locales?: (string | { code: string })[] }
}
