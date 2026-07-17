import type { DevFontsProps } from '../types'
import { extractFonts } from '../extractFonts'
import { readFontsMarker } from '../lib/marker'
import { resolveFontFamilies } from '../lib/families'
import { buildFontFaceCss, getActiveFontFaces } from '../lib/activeFonts'

export async function DevFonts({
  payload,
  definition,
  cssVarPrefix,
  fontSetSlug,
  optimizedSlug,
  families,
}: DevFontsProps): Promise<React.ReactElement | null> {
  if (process.env.NODE_ENV === 'production') return null
  if (definition && extractFonts(definition)) return null

  let css = ''
  try {
    const instance = await payload
    // The plugin resolved these once at boot and left them on the marker, so a renamed collection
    // or global is followed here without the app repeating itself. An explicit prop still wins.
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
    console.warn('[payload-fonts] DevFonts failed to load the active fonts:', err)
    return null
  }
  if (!css) return null

  return <style data-payload-fonts-dev dangerouslySetInnerHTML={{ __html: css }} />
}

export default DevFonts
