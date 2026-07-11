/** A family key. `sans`/`serif`/`mono`/`display` by default, but any string when customised. */
export type FontFamily = string

/** A family as the consumer declares it. Only `key` is required; the rest default by convention. */
export interface FontFamilyConfig {
  /** Stable identifier. Used as the `family` value, the `fontSet` slot name, the export JSON key,
   *  and (capitalised) the generated `font<Key>` export + `--font-set<Key>` CSS variable. */
  key: string
  /** Admin label for the `family` radio option and the `fontSet` slot. @default capitalised `key` */
  label?: string
  /** CSS fallback stack appended after the served family in the family variable (dev preview /
   *  custom serving). @default `'ui-sans-serif, system-ui, sans-serif'` */
  fallback?: string
}

/** A family with every field resolved — what the internals actually consume. */
export interface ResolvedFontFamily {
  key: string
  label: string
  fallback: string
}
