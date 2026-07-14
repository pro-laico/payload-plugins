import type { Config, Plugin } from 'payload'

import type { FontsPluginOptions } from './types'
import { probeSubsetter } from './lib/optimizeFont'
import { resolveFontFamilies } from './lib/families'
import { createFontCollection } from './collections/font'
import { exportFontsEndpoint } from './endpoints/exportFonts'
import { mergeCollection, mergeGlobal } from './lib/mergeConfig'
import { createFontSetGlobal, FONT_SET_SLUG } from './globals/fontSet'
import { createFontOriginalCollection, FONT_ORIGINAL_SLUG } from './collections/fontOriginal'
import { createFontOptimizedCollection, FONT_OPTIMIZED_SLUG } from './collections/fontOptimized'

export const fontsPlugin =
  (opts: FontsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const {
      enabled = true,
      charset,
      families,
      fontOverrides,
      fontOriginalOverrides,
      fontOptimizedOverrides,
      includeFontSet = true,
      fontSetOverrides,
    } = opts
    if (!enabled) return config

    const familyKeys = resolveFontFamilies(families).map((r) => r.key)

    const collections = [
      ...(config.collections ?? []),
      mergeCollection(
        createFontCollection({ charset, families, originalSlug: FONT_ORIGINAL_SLUG, optimizedSlug: FONT_OPTIMIZED_SLUG }),
        fontOverrides,
      ),
      mergeCollection(createFontOriginalCollection(), fontOriginalOverrides),
      mergeCollection(createFontOptimizedCollection({ fontSlug: 'font', originalSlug: FONT_ORIGINAL_SLUG }), fontOptimizedOverrides),
    ]

    const globals = includeFontSet
      ? [...(config.globals ?? []), mergeGlobal(createFontSetGlobal({ families }), fontSetOverrides)]
      : config.globals
    const endpoints = [
      ...(config.endpoints ?? []),
      exportFontsEndpoint({ fontSetGlobalSlug: FONT_SET_SLUG, fontOptimizedSlug: FONT_OPTIMIZED_SLUG, families: familyKeys }),
    ]

    return {
      ...config,
      collections,
      globals,
      endpoints,
      custom: {
        ...config.custom,
        payloadFonts: {
          options: opts,
          fontSlug: fontOverrides?.slug ?? 'font',
          fontOriginalSlug: FONT_ORIGINAL_SLUG,
          fontOptimizedSlug: FONT_OPTIMIZED_SLUG,
          fontSetSlug: includeFontSet ? FONT_SET_SLUG : null,
          familyKeys,
          exportPath: '/fonts/export',
        },
      },
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
