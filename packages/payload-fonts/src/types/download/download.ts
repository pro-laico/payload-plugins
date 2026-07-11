// A family key. `sans`/`serif`/`mono`/`display` by default, but the plugin's `families` option can
// replace or extend them — so this CLI never hardcodes the list; it discovers the active families
// from the keys of the export response and derives each family's `next/font` export name + CSS
// variable from the same shared convention (`sans` → `fontSans` / `--font-setSans`).
export type Family = string

/** A written weight file, ready to emit into a generated `localFont` `src` array. */
export type WeightFile = { path: string; weight: string; style: string }

export type RunDownloadFontsOptions = {
  /** Directory for downloaded font files. Default `./public/fonts` or `PAYLOAD_FONTS_OUTPUT_DIR`. */
  fontsOutputDir?: string
  /** Generated `next/font/local` module path. Default `./src/app/definition.ts` or `PAYLOAD_FONTS_DEFINITION_FILE`. */
  definitionFile?: string
  /** Dotenv file to load before reading env. Default `./.env.local` then `./.env` (Next
   *  convention, `.env.local` wins), or `PAYLOAD_FONTS_ENV_FILE` to load exactly one file. */
  envFile?: string
  /**
   * `src` path passed to `localFont()` in the generated file (relative to the definition file's
   * directory). Default `../../public/fonts` or `PAYLOAD_FONTS_SRC_PREFIX`. If you change
   * `fontsOutputDir`, set this accordingly.
   */
  localFontSrcPrefix?: string
  /**
   * Prefix for the CSS custom properties emitted by the generated `localFont()` calls. The slot
   * name is appended capitalised (e.g. `--font-setSans`). Default `--font-set` or
   * `PAYLOAD_FONTS_CSS_VAR_PREFIX`. Change it only if your stylesheet references different names.
   */
  cssVariablePrefix?: string
  /** Base URL of the running Payload instance to fetch from. Default `FONT_DOWNLOAD_URL`. */
  siteUrl?: string
  /**
   * Path of the plugin's fonts export endpoint, resolved against the site URL. Default
   * `/api/fonts/export` or `PAYLOAD_FONTS_ENDPOINT`.
   */
  endpointPath?: string
  /**
   * When true, failures also print the full underlying error object (stack, cause, …). Defaults
   * to false (or `PAYLOAD_FONTS_VERBOSE`), so a routine local failure shows only the short
   * message. Enable with the `--verbose` / `-v` CLI flag or `PAYLOAD_FONTS_VERBOSE=true` when you
   * need to debug the error itself.
   */
  verbose?: boolean
}
