import type { PreviewFontsProps } from '../types'
import { readFontsMarker } from '../lib/marker'
import { resolveFontFamilies } from '../lib/families'
import { buildFontFaceCss, getActiveFontFaces } from '../lib/activeFonts'

/** Inlines the **live** font selection as `@font-face` at render time, read straight from the
 * database — not from a baked `next/font/local` module. It runs in dev *and* production, so it's the
 * isolated escape hatch for previewing a font before it's baked: mount it in the one context where
 * you're previewing (a preview route, or behind `draftMode()`) *instead of* the baked
 * `extractFonts()` className, and it shows the current selection with no rebuild.
 *
 * The default serving path is baked and uniform (`extractFonts` on `<html>`, produced by
 * `payload fonts:download`). This is deliberately separate: it does its own thing, wherever you put
 * it, and stays out of the main render path. */
export async function PreviewFonts({
  payload,
  cssVarPrefix,
  fontSetSlug,
  optimizedSlug,
  families,
}: PreviewFontsProps): Promise<React.ReactElement | null> {
  let css = ''
  try {
    const instance = await payload
    // The plugin resolved these once at boot and left them on the marker, so a renamed collection or
    // global is followed here without the app repeating itself. An explicit prop still wins.
    const marker = readFontsMarker(instance.config)
    const fontSet = fontSetSlug ?? marker?.fontSetSlug ?? undefined
    const optimized = optimizedSlug ?? marker?.fontOptimizedSlug
    const resolved = families ? resolveFontFamilies(families) : undefined
    const fallbacks = resolved ? Object.fromEntries(resolved.map((r) => [r.key, r.fallback])) : undefined
    const typefaces = await getActiveFontFaces(instance, {
      fontSetSlug: fontSet,
      optimizedSlug: optimized,
      families: resolved?.map((r) => r.key),
    })
    css = buildFontFaceCss(typefaces, { cssVarPrefix, optimizedSlug: optimized, fallbacks })
  } catch (err) {
    console.warn('[payload-fonts] PreviewFonts failed to load the active fonts:', err)
    return null
  }
  if (!css) return null

  return <style data-payload-fonts-preview dangerouslySetInnerHTML={{ __html: css }} />
}

export default PreviewFonts
