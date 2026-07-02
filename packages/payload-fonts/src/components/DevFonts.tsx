import { getPayload } from 'payload'
import { extractFonts } from '../extractFonts'
import { buildFontFaceCss, getActiveFontFaces } from '../lib/activeFonts'
import { type FontFamilyConfig, resolveFontFamilies } from '../lib/families'

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

/**
 * **Development-only** font loading. In production it renders `null` — your app self-hosts fonts
 * with `next/font/local` (the build-time export + `payload-fonts-download` CLI), which keeps the
 * production path stock `next/font`: precise preloading, size-adjusted fallbacks, static assets.
 *
 * In development (`NODE_ENV !== 'production'`) it reads the active `fontSet` selection from Payload
 * and inlines the matching `@font-face` rules + the `--font-set*` family variables, so fonts show up
 * immediately with no build step — change a typeface in the admin, refresh, see it. Because it
 * emits the **same** family variables `next/font` defines in production, your app's
 * `font-family: var(--font-setSans)` resolves identically across environments.
 *
 * Drop it into your root layout alongside the production wiring — each is a no-op in the other
 * environment:
 *
 * ```tsx
 * import config from '@payload-config'
 * import definitionFonts from '@/app/definition'
 * import { extractFonts } from '@pro-laico/payload-fonts'
 * import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'
 *
 * <html className={extractFonts(definitionFonts)}>
 *   <head><DevFonts config={config} definition={definitionFonts} /></head>
 * </html>
 * ```
 */
export async function DevFonts({
  config,
  definition,
  cssVarPrefix,
  fontSetSlug,
  optimizedSlug,
  families,
}: DevFontsProps): Promise<React.ReactElement | null> {
  // Production self-hosts via next/font — never touch the runtime path there.
  if (process.env.NODE_ENV === 'production') return null
  // If the build path already produced fonts, stand down so there's exactly one source of truth
  // (this is how you preview the real production path locally — run `generate:fonts`).
  if (definition && extractFonts(definition)) return null

  let css = ''
  try {
    // Only resolve `families` when explicitly given (custom fallbacks); otherwise let
    // getActiveFontFaces auto-discover the slots from the global and use the default fallbacks.
    const resolved = families ? resolveFontFamilies(families) : undefined
    const fallbacks = resolved ? Object.fromEntries(resolved.map((r) => [r.key, r.fallback])) : undefined
    const payload = await getPayload({ config })
    const typefaces = await getActiveFontFaces(payload, { fontSetSlug, optimizedSlug, families: resolved?.map((r) => r.key) })
    css = buildFontFaceCss(typefaces, { cssVarPrefix, optimizedSlug, fallbacks })
  } catch (err) {
    // No DB / not seeded yet — render nothing rather than throw in the layout, but say why
    // (dev-only component, so the warning never reaches production logs).
    console.warn('[payload-fonts] DevFonts failed to load the active fonts:', err)
    return null
  }
  if (!css) return null

  // biome-ignore lint/security/noDangerouslySetInnerHtml: server-built CSS from our own data, no user input.
  return <style data-payload-fonts-dev dangerouslySetInnerHTML={{ __html: css }} />
}

export default DevFonts
