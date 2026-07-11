import type { getPayload } from 'payload'

import type { FontFamilyConfig } from '../families/families'

/** The shape `next/font/local` produces for each declared font — only the generated
 *  `variable` (its CSS-variable class) is read here. */
export type FontDefinitions = Record<string, { variable?: string } | undefined>

export interface DevFontsProps {
  /** Your Payload config — the same `@payload-config` import you pass to `getPayload`. */
  config: Parameters<typeof getPayload>[0]['config']
  /**
   * The generated `next/font/local` definition (`import definitionFonts from '@/app/definition'`).
   * When it already has fonts, this component renders nothing and lets `next/font` take over — so
   * running `generate:fonts` against your dev server lets you preview the exact production path
   * locally. Omit it and DevFonts always renders in dev.
   */
  definition?: Record<string, { variable?: string } | undefined>
  /** CSS family-variable prefix; must match the download CLI's `cssVariablePrefix`. @default '--font-set' */
  cssVarPrefix?: string
  /** Slug of the standalone font-selection global. @default 'fontSet' */
  fontSetSlug?: string
  /** Slug of the optimized (served) upload collection. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Optional. The family slots are auto-discovered from the `fontSet` global, so you only need this
   *  if you set custom per-family `fallback` stacks and want the dev preview to match them. */
  families?: FontFamilyConfig[]
}
