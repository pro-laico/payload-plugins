import type { Payload } from 'payload'
import type { FontFamilyConfig } from '../families/families'

/** Props for `<PreviewFonts>` — the live-selection escape hatch. No `definition`: unlike the old
 * dev component it never stands down for a baked module, because you mount it *instead of* the baked
 * `extractFonts()` className, in the isolated context where you're previewing. */
export interface PreviewFontsProps {
  payload: Payload | Promise<Payload>
  cssVarPrefix?: string
  fontSetSlug?: string
  optimizedSlug?: string
  families?: FontFamilyConfig[]
}

/** The shape of the generated `definition` module (`payload fonts:download` output) that
 * `extractFonts` reads the `next/font/local` variable classes from. */
export type FontDefinitions = Record<string, { variable?: string } | undefined>
