import type { DevFontsProps } from '../types'
import { extractFonts } from '../extractFonts'
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
    const resolved = families ? resolveFontFamilies(families) : undefined
    const fallbacks = resolved ? Object.fromEntries(resolved.map((r) => [r.key, r.fallback])) : undefined
    const typefaces = await getActiveFontFaces(await payload, { fontSetSlug, optimizedSlug, families: resolved?.map((r) => r.key) })
    css = buildFontFaceCss(typefaces, { cssVarPrefix, optimizedSlug, fallbacks })
  } catch (err) {
    console.warn('[payload-fonts] DevFonts failed to load the active fonts:', err)
    return null
  }
  if (!css) return null

  return <style data-payload-fonts-dev dangerouslySetInnerHTML={{ __html: css }} />
}

export default DevFonts
