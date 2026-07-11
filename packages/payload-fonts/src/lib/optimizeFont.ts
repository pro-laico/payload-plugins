import type { Charset, FontFileMetadata, FontkitFont, SubsetFontFn } from '../types'

/**
 * Built-in charset presets, expressed as inclusive Unicode code-point ranges. Each
 * preset is expanded to a string of characters that the subsetter keeps; everything
 * else is dropped to shrink the file.
 */
const CHARSET_PRESETS: Record<string, Array<[number, number]>> = {
  // Printable ASCII + Latin-1 Supplement (Western-European accents: é ñ ü ç …) plus the
  // typographic punctuation CMS/word-processor content relies on (curly quotes, en/em
  // dashes, ellipsis, €, ™) so common copy doesn't fall back.
  latin: [
    [0x20, 0x7e],
    [0xa0, 0xff],
    [0x2010, 0x2014],
    [0x2018, 0x201f],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x20ac, 0x20ac],
    [0x2122, 0x2122],
  ],
  // Everything in `latin` plus Latin Extended-A/B (Central/Eastern-European: ą ž ł ő …).
  'latin-ext': [
    [0x20, 0x7e],
    [0xa0, 0xff],
    [0x100, 0x24f],
    [0x2010, 0x2014],
    [0x2018, 0x201f],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x20ac, 0x20ac],
    [0x2122, 0x2122],
  ],
}

const rangesToText = (ranges: Array<[number, number]>): string => {
  let text = ''
  for (const [start, end] of ranges) for (let cp = start; cp <= end; cp++) text += String.fromCodePoint(cp)
  return text
}

/**
 * Resolve a charset option to the set of characters the subsetter should keep. A known
 * preset name ('latin' | 'latin-ext') expands to its ranges; any other string is treated
 * as an explicit, verbatim list of characters to retain.
 */
export const resolveCharsetText = (charset: Charset = 'latin'): string => {
  const preset = CHARSET_PRESETS[charset]
  return preset ? rangesToText(preset) : charset
}

/** Clamp an arbitrary OS/2 weight class to the nearest standard 100–900 step. */
const normalizeWeight = (weight?: number): string | undefined => {
  if (!weight || Number.isNaN(weight)) return undefined
  return String(Math.min(900, Math.max(100, Math.round(weight / 100) * 100)))
}

/**
 * Best-effort read of weight / style / family from a font's metadata via the bundled
 * `fontkit` dependency. Returns `null` when the font can't be parsed.
 *
 * A `wght` variation axis marks a variable font: we keep its full `min max` range (e.g.
 * `'100 900'`) — exactly what `next/font/local` expects — instead of clamping to the
 * single default-instance weight class as we do for static fonts.
 *
 * An upright variable file whose axes ALSO cover italics — a true `ital` axis reaching 1, or a
 * `slnt` axis leaning forward (negative min) — is flagged `italCapable`, so the serving layers
 * can emit an italic `@font-face` from the same file (CSS maps `font-style: italic` onto `ital`
 * and `font-style: oblique <angle>` onto `slnt`).
 */
export async function detectMetadata(buffer: Buffer): Promise<FontFileMetadata | null> {
  try {
    // fontkit v2 ships `create` as a NAMED export under node's ESM interop (no usable
    // `default`), but bundlers may synthesize a default — accept either, or detection
    // silently no-ops and weight/style/family never autofill.
    const mod = (await import('fontkit')) as unknown as { create?: (b: Buffer) => unknown; default?: { create?: (b: Buffer) => unknown } }
    const create = mod.create ?? mod.default?.create
    if (!create) return null
    const font = create(buffer) as FontkitFont
    const italic = Boolean(
      (typeof font.italicAngle === 'number' && font.italicAngle !== 0) ||
        (font['OS/2']?.fsSelection ?? 0) & 0x01 ||
        /italic|oblique/i.test(font.subfamilyName ?? ''),
    )
    const wght = font.variationAxes?.wght
    const weight = wght ? `${Math.round(wght.min)} ${Math.round(wght.max)}` : normalizeWeight(font['OS/2']?.usWeightClass)

    let italCapable: boolean | undefined
    let obliqueAngle: number | undefined
    if (!italic) {
      const ital = font.variationAxes?.ital
      const slnt = font.variationAxes?.slnt
      if (ital && ital.max >= 1) italCapable = true
      else if (slnt && slnt.min < 0) {
        italCapable = true
        obliqueAngle = Math.round(Math.abs(slnt.min))
      }
    }

    return {
      familyName: font.familyName ?? undefined,
      weight,
      style: italic ? 'italic' : 'normal',
      isVariable: Boolean(wght),
      ...(italCapable ? { italCapable } : {}),
      ...(obliqueAngle ? { obliqueAngle } : {}),
    }
  } catch {
    return null
  }
}

/**
 * Subset a font buffer to a WOFF2 using the bundled `subset-font` (harfbuzz). Variable
 * axes are preserved (harfbuzz keeps `fvar`/`gvar` unless axes are explicitly pinned), so
 * a variable font stays variable through the subset.
 */
export async function subsetToWoff2(buffer: Buffer, charsetText: string): Promise<Buffer> {
  const subsetFont = (await import('subset-font')).default as unknown as SubsetFontFn
  return subsetFont(buffer, charsetText, { targetFormat: 'woff2' })
}

/**
 * The most common deployment mistake: a bundler (Next/Turbopack) bundles the harfbuzz / fontkit
 * wasm + native assets, rewriting their load paths to virtual ones that don't exist on disk. The
 * subset then throws at runtime, fonts upload but never get subsetted, and nothing is served.
 * True when an error is that load failure (vs. an ordinary bad-font error).
 */
export const isSubsetterLoadError = (err: unknown): boolean => {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  return (
    /(hb-subset\.wasm|harfbuzzjs|subset-font|fontkit)/i.test(msg) &&
    /(ENOENT|no such file|cannot find module|failed to load|MODULE_NOT_FOUND)/i.test(msg)
  )
}

/**
 * Boot-time probe for that mistake. Importing `subset-font` is NOT enough to detect it — harfbuzz
 * reads its wasm lazily (`_.once`) on the FIRST SUBSET CALL — so this runs a real subset on a
 * garbage buffer: the wasm loads (and fails loudly if bundled) before the buffer is ever parsed.
 * Resolves `null` when the subsetter is healthy — a bad-font error from the garbage buffer proves
 * the wasm loaded — or the load error for the caller to report.
 */
export async function probeSubsetter(): Promise<unknown | null> {
  try {
    await subsetToWoff2(Buffer.from('not a font'), 'a')
  } catch (err) {
    if (isSubsetterLoadError(err)) return err
  }
  return null
}
