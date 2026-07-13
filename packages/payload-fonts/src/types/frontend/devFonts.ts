import type { Payload } from 'payload'

import type { FontFamilyConfig } from '../families/families'

/** The shape `next/font/local` produces for each declared font — only the generated
 *  `variable` (its CSS-variable class) is read here. */
export type FontDefinitions = Record<string, { variable?: string } | undefined>

export interface DevFontsProps {
  /** Your app's live Payload session — instance or the `getPayload({ config })` promise
   *  (passed as-is; only this component awaits it). Package code never resolves Payload. */
  payload: Payload | Promise<Payload>
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
