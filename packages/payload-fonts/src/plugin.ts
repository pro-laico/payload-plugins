import type { CollectionConfig, Config, GlobalConfig, Plugin } from 'payload'

import { createFontCollection } from './collections/font'
import { createFontOptimizedCollection, FONT_OPTIMIZED_SLUG } from './collections/fontOptimized'
import { createFontOriginalCollection, FONT_ORIGINAL_SLUG } from './collections/fontOriginal'
import { exportFontsEndpoint } from './endpoints/exportFonts'
import { createFontSetGlobal, FONT_SET_SLUG } from './globals/fontSet'
import type { Charset } from './hooks/optimizeFont'
import { mergeCollection, mergeGlobal } from './lib/mergeConfig'
import { type FontFamilyConfig, resolveFontFamilies } from './lib/families'

export interface FontsPluginOptions {
  /** When false, the plugin is a no-op. Defaults to true. */
  enabled?: boolean
  /**
   * Characters the subsetter keeps when building the served WOFF2 files: a preset name
   * (`'latin'` — ASCII + Latin-1 + common punctuation, the default; or `'latin-ext'`) or an
   * explicit string of characters to retain.
   */
  charset?: Charset
  /**
   * The font *families* (slots) the plugin exposes end-to-end — the `family` options on the `font`
   * collection, the relationship slots on the `fontSet` global, the keys in the export JSON, and
   * (capitalised) the generated `font<Key>` / `--font-set<Key>` names. Defaults to the built-in
   * `sans / serif / mono / display`. Pass your own list to replace, extend, drop, or reorder them
   * — e.g. `[{ key: 'sans' }, { key: 'display' }, { key: 'brand', fallback: 'Georgia, serif' }]`.
   * Each entry is `{ key, label?, fallback? }`; only `key` is required.
   */
  families?: FontFamilyConfig[]
  /** Merged onto the visible `font` (typeface) collection. */
  fontOverrides?: Partial<CollectionConfig>
  /**
   * Merged onto the hidden `fontOriginal` upload collection (the raw files editors upload
   * into) — e.g. `upload: { staticDir }`.
   */
  fontOriginalOverrides?: Partial<CollectionConfig>
  /** Merged onto the hidden `fontOptimized` upload collection (the served WOFF2s). */
  fontOptimizedOverrides?: Partial<CollectionConfig>
  /**
   * Register the `fontSet` global — the active sans/serif/mono/display selection that the export
   * endpoint (and your frontend) reads. **On by default**, since it's the only place to mark which
   * typefaces are active; set `false` only if you drive that selection some other way (without it
   * the export endpoint has nothing to resolve and returns no fonts).
   */
  includeFontSet?: boolean
  /** Merged onto the `fontSet` global when {@link includeFontSet} is true. */
  fontSetOverrides?: Partial<GlobalConfig>
}

/**
 * `@pro-laico/payload-fonts` — three collections, standard Payload primitives:
 *
 * - `font` (visible): the typeface. Editors drop files into `upload` fields backed by
 *   `fontOriginal` (a `variable` group or a `weights` array). Seed it by uploading the raw files
 *   to `fontOriginal` and referencing them from the typeface's slots.
 * - `fontOriginal` (hidden): the raw uploaded files. Register it with your storage adapter's
 *   client-uploads instance to keep big fonts off the request body in production.
 * - `fontOptimized` (hidden): the subsetted WOFF2 the site serves, built from the originals by
 *   the `font` save hook. Always server-side stored.
 *
 * Plus the `fontSet` global (the active selection — on by default) and the `GET /api/fonts/export`
 * endpoint the `payload-fonts-download` CLI reads to write fonts for `next/font/local`.
 */
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
      // Stash the resolved slugs + families so decoupled tooling (e.g. @pro-laico/payload-dev-tools)
      // can discover the plugin and read them from just `payload.config` — no import.
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
        // Dev-only probe for the most common deployment mistake: a bundler inlined the subsetter's
        // wasm/native assets, so `subset-font` throws at import — which otherwise only surfaces on
        // the first font save. Importing is the same load path the optimize hook takes, and the
        // wasm is read at module init, so the import alone trips the failure. Not awaited (never
        // slows boot) and never runs in production.
        if (process.env.NODE_ENV !== 'production') {
          import('subset-font').catch((err) => {
            payload.logger.error(
              `[payload-fonts] The font subsetter failed to load — uploaded fonts will NOT be subsetted or served. In Next.js add \`serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit']\` to your next.config. (${err instanceof Error ? err.message : err})`,
            )
          })
        }
      },
    }
  }

export default fontsPlugin
