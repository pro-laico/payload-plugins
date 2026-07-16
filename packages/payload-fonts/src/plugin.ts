import type { Config, Plugin } from 'payload'

import { resolveOptions } from './options'
import { probeSubsetter } from './lib/optimizeFont'
import { resolveFontFamilies } from './lib/families'
import { createFontCollection } from './collections/font'
import { exportFontsEndpoint } from './endpoints/exportFonts'
import { mergeCollection, mergeGlobal } from './lib/mergeConfig'
import { createFontSetGlobal, FONT_SET_SLUG } from './globals/fontSet'
import type { FontsPluginOptions, PayloadFontsMarker } from './types'
import { createFontOriginalCollection, FONT_ORIGINAL_SLUG } from './collections/fontOriginal'
import { createFontOptimizedCollection, FONT_OPTIMIZED_SLUG } from './collections/fontOptimized'

export const fontsPlugin =
  (opts: FontsPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const { enabled, font, fontOriginal, fontOptimized, fontSet, charset, families } = resolveOptions(opts)
    if (!enabled) return config

    const familyKeys = resolveFontFamilies(families).map((r) => r.key)

    const collections = [
      ...(config.collections ?? []),
      mergeCollection(createFontCollection({ charset, families, originalSlug: FONT_ORIGINAL_SLUG, optimizedSlug: FONT_OPTIMIZED_SLUG }), font),
      mergeCollection(createFontOriginalCollection(), fontOriginal),
      mergeCollection(createFontOptimizedCollection({ fontSlug: 'font', originalSlug: FONT_ORIGINAL_SLUG }), fontOptimized),
    ]

    const globals = fontSet !== false ? [...(config.globals ?? []), mergeGlobal(createFontSetGlobal({ families }), fontSet)] : config.globals
    const endpoints = [
      ...(config.endpoints ?? []),
      exportFontsEndpoint({ fontSetGlobalSlug: FONT_SET_SLUG, fontOptimizedSlug: FONT_OPTIMIZED_SLUG, families: familyKeys }),
    ]

    const marker: PayloadFontsMarker = {
      options: opts,
      fontSlug: font?.slug ?? 'font',
      fontOriginalSlug: FONT_ORIGINAL_SLUG,
      fontOptimizedSlug: FONT_OPTIMIZED_SLUG,
      fontSetSlug: fontSet !== false ? FONT_SET_SLUG : null,
      familyKeys,
      exportPath: '/fonts/export',
    }

    return {
      ...config,
      collections,
      globals,
      endpoints,
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
