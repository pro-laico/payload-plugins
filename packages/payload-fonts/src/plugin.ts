import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { probeSubsetter } from './lib/optimizeFont'
import { resolveFontFamilies } from './lib/families'
import { createFontSetGlobal, FONT_SET_SLUG } from './globals/fontSet'
import type { FontsPluginOptions, PayloadFontsMarker } from './types'
import { createFontCollection, FONT_SLUG } from './collections/font'
import { assertNoFieldCollisions, binScriptPath, mergeCollection, mergeGlobal } from './_kit'
import { exportFontsEndpoint, FONTS_EXPORT_PATH } from './endpoints/exportFonts'
import { createFontOriginalCollection, FONT_ORIGINAL_SLUG } from './collections/fontOriginal'
import { createFontOptimizedCollection, FONT_OPTIMIZED_SLUG } from './collections/fontOptimized'

const PLUGIN = 'payload-fonts'

/** Self-hosted fonts editors control: upload a typeface, it's subsetted on save and served
 * through `next/font/local`.
 *
 * - `enabled`
 * - `collections`
 * - `globals`
 * - `options`
 */
export const fontsPlugin =
  (opts: FontsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const { enabled, collections: cols, globals: globs, options } = resolveOptions(opts)
    if (!enabled) return config

    const { charset, families } = options
    const familyKeys = resolveFontFamilies(families).map((r) => r.key)

    // Each slug is resolved exactly once, here: the override's `slug` or the default. Every
    // internal reference — the fontOptimized→font relationship, the fontSet slots, the upload
    // relationships, the hooks' queries, the export endpoint, the marker the bin reads — is built
    // from these, so renaming a collection can't leave a dangling reference behind.
    const { fontSet } = globs
    const fontSlug = cols.font.slug ?? FONT_SLUG
    const originalSlug = cols.fontOriginal.slug ?? FONT_ORIGINAL_SLUG
    const optimizedSlug = cols.fontOptimized.slug ?? FONT_OPTIMIZED_SLUG
    const fontSetSlug = fontSet === false ? null : (fontSet.slug ?? FONT_SET_SLUG)

    const fontBase = createFontCollection({ slug: fontSlug, originalSlug, optimizedSlug, charset, families })
    const originalBase = createFontOriginalCollection({ slug: originalSlug })
    const optimizedBase = createFontOptimizedCollection({ slug: optimizedSlug, fontSlug, originalSlug })
    assertNoFieldCollisions(PLUGIN, 'font', fontBase.fields, cols.font.overrides?.fields)
    assertNoFieldCollisions(PLUGIN, 'fontOriginal', originalBase.fields, cols.fontOriginal.overrides?.fields)
    assertNoFieldCollisions(PLUGIN, 'fontOptimized', optimizedBase.fields, cols.fontOptimized.overrides?.fields)

    const collections = [
      ...(config.collections ?? []),
      mergeCollection(fontBase, cols.font.overrides),
      mergeCollection(originalBase, cols.fontOriginal.overrides),
      mergeCollection(optimizedBase, cols.fontOptimized.overrides),
    ]

    let globals = config.globals
    if (fontSet !== false && fontSetSlug) {
      const fontSetBase = createFontSetGlobal({ slug: fontSetSlug, fontSlug, families })
      assertNoFieldCollisions(PLUGIN, 'fontSet', fontSetBase.fields, fontSet.overrides?.fields)
      globals = [...(config.globals ?? []), mergeGlobal(fontSetBase, fontSet.overrides)]
    }

    const endpoints = [
      ...(config.endpoints ?? []),
      exportFontsEndpoint({ path: FONTS_EXPORT_PATH, fontSetGlobalSlug: fontSetSlug, fontOptimizedSlug: optimizedSlug, families: familyKeys }),
    ]

    const marker: PayloadFontsMarker = {
      options: opts,
      fontSlug,
      fontOriginalSlug: originalSlug,
      fontOptimizedSlug: optimizedSlug,
      fontSetSlug,
      familyKeys,
      exportPath: FONTS_EXPORT_PATH,
    }

    return {
      ...config,
      collections,
      globals,
      endpoints,
      // `payload fonts:download` — the build reads fonts through the Local API, so it needs no
      // running site (the `payload-fonts-download` CLI's HTTP path stays for remote builds).
      bin: [...(config.bin ?? []), { key: 'fonts:download', scriptPath: binScriptPath(import.meta.url, 'downloadFonts') }],
      custom: { ...config.custom, payloadFonts: marker },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        if (process.env.NODE_ENV !== 'production') {
          void probeSubsetter().then((err) => {
            if (err) {
              payload.logger.error(
                `[payload-fonts] The font subsetter failed to load — uploaded fonts will NOT be subsetted or served. In Next.js add \`serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit']\` to your next.config. (${err instanceof Error ? err.message : err})`,
              )
            }
          })
        }
      },
    }
  }

export default fontsPlugin
