import type { CollectionSlug, GlobalSlug, Payload } from 'payload'

import { refId } from './refs'
import { DEFAULT_FONT_FAMILIES, familyVarSuffix } from './families'

/** A family key. `sans`/`serif`/`mono`/`display` by default, but any string when customised. */
export type FontFamily = string

/** One served face. Usually one per `fontOptimized` doc — but an upright variable file whose
 *  axes also cover italics (`italCapable`) expands into a second, italic face over the SAME file. */
export interface ActiveFace {
  filename: string
  /** A single CSS weight ('400') or a variable range ('100 900'). */
  weight: string
  style: 'normal' | 'italic'
  /** For slnt-based italics: the positive CSS `oblique` angle (deg). Absent = a true italic
   *  (explicit file, or an `ital` axis that `font-style: italic` activates). */
  obliqueAngle?: number
}

/** A raw `fontOptimized` doc's face fields, before ital-capability expansion. */
type RawFace = ActiveFace & { italCapable?: boolean }

/**
 * Expand one typeface's raw faces into the served set: an upright, ital-capable variable face
 * contributes an extra italic face over the same file — unless the typeface already has an
 * explicit italic file, which always wins. Exported for reuse (the export endpoint applies the
 * same rule) and for tests.
 */
export function expandItalCapableFaces(faces: RawFace[]): ActiveFace[] {
  const hasExplicitItalic = faces.some((f) => f.style === 'italic')
  return faces.flatMap(({ italCapable, ...face }) => {
    // obliqueAngle is only meaningful on the synthesized italic face — never on an upright.
    const { obliqueAngle: _drop, ...upright } = face
    if (face.style === 'normal' && italCapable && !hasExplicitItalic) {
      return [upright, { ...face, style: 'italic' as const }]
    }
    return [face.style === 'normal' ? upright : face]
  })
}

/** The typeface active for a family, plus its served faces. */
export interface ActiveTypeface {
  family: FontFamily
  id: string | number
  faces: ActiveFace[]
}

export interface GetActiveFontFacesOptions {
  /** Slug of the standalone font-selection global. @default 'fontSet' */
  fontSetSlug?: string
  /** Slug of the optimized (served) upload collection. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Family keys to read. Omit to auto-discover them from the `fontSet` global's own slots. */
  families?: FontFamily[]
}

/** Payload global meta keys that aren't family slots — filtered out when auto-discovering. */
const GLOBAL_META_KEYS = new Set(['id', 'globalType', 'createdAt', 'updatedAt'])
/** The family slots on a `fontSet` global doc: its own keys, minus Payload's metadata. */
const familyKeysFromGlobal = (global: Record<string, unknown> | null | undefined): FontFamily[] =>
  global ? Object.keys(global).filter((k) => !k.startsWith('_') && !GLOBAL_META_KEYS.has(k)) : []

/**
 * Resolve the active `fontSet` selection to each family's served `fontOptimized` files. Used by the
 * {@link DevFonts} component (and available for custom font-serving) to build `@font-face` rules
 * from CMS data at runtime. Returns `[]` if no global / no selection.
 */
export async function getActiveFontFaces(payload: Payload, opts: GetActiveFontFacesOptions = {}): Promise<ActiveTypeface[]> {
  const fontSetSlug = (opts.fontSetSlug ?? 'fontSet') as GlobalSlug
  const optimizedSlug = (opts.optimizedSlug ?? 'fontOptimized') as CollectionSlug

  let selection: Partial<Record<FontFamily, unknown>>
  try {
    // `as unknown as` — in a project with generated types findGlobal resolves to the concrete
    // fontSet interface, which doesn't structurally overlap a string-keyed record.
    selection = (await payload.findGlobal({ slug: fontSetSlug, depth: 0, overrideAccess: true })) as unknown as Partial<
      Record<FontFamily, unknown>
    >
  } catch {
    return [] // fontSet global not registered
  }

  // Explicit list, else auto-discover the family slots from the global itself — so a custom
  // `families` set works here with no extra config (the global's slots are the source of truth).
  const families = opts.families ?? familyKeysFromGlobal(selection as Record<string, unknown>)

  // Resolve each family's selected typeface id once, then fetch every family's served files in a
  // single query (grouped by typeface) rather than one round-trip per family.
  const familyIds = families
    .map((family) => ({ family, id: refId(selection?.[family]) }))
    .filter((r): r is { family: FontFamily; id: string | number } => r.id != null)
  if (!familyIds.length) return []

  const uniqueIds = [...new Set(familyIds.map((r) => r.id))]
  const res = await payload.find({ collection: optimizedSlug, where: { font: { in: uniqueIds } }, depth: 0, limit: 1000, overrideAccess: true })

  const facesByFont = new Map<string | number, RawFace[]>()
  for (const d of res.docs as unknown as Array<Record<string, unknown>>) {
    if (typeof d.filename !== 'string') continue
    const fontId = refId(d.font)
    if (fontId == null) continue
    const face: RawFace = {
      filename: d.filename,
      weight: (d.weight as string) || '400',
      style: d.style === 'italic' ? 'italic' : 'normal',
      ...(d.italCapable ? { italCapable: true } : {}),
      ...(typeof d.obliqueAngle === 'number' ? { obliqueAngle: d.obliqueAngle } : {}),
    }
    const bucket = facesByFont.get(fontId)
    if (bucket) bucket.push(face)
    else facesByFont.set(fontId, [face])
  }

  const out: ActiveTypeface[] = []
  for (const { family, id } of familyIds) {
    const faces = facesByFont.get(id)
    if (faces?.length) out.push({ family, id, faces: expandItalCapableFaces(faces) })
  }
  return out
}

/** Generic CSS fallback stack for the built-in families, appended after the served family in the
 *  family variable. Overridable per family via {@link BuildFontFaceCssOptions.fallbacks}. */
const GENERIC_FALLBACK: Record<string, string> = Object.fromEntries(DEFAULT_FONT_FAMILIES.map((r) => [r.key, r.fallback]))
/** Used for a custom family with no declared fallback. */
const DEFAULT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

/** Payload serves an upload file at `/api/<slug>/file/<filename>` (public read on `fontOptimized`). */
const faceUrl = (filename: string, slug: string) => `/api/${slug}/file/${encodeURIComponent(filename)}`

export interface BuildFontFaceCssOptions {
  /** Prefix for the emitted CSS family variables; the capitalised family is appended (`--font-setSans`).
   *  Must match the download CLI's `cssVariablePrefix`. @default '--font-set' */
  cssVarPrefix?: string
  /** Slug used to build the served file URL. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Per-family CSS fallback stack override (`{ brand: 'Georgia, serif' }`). Falls back to the
   *  built-in family defaults, then a generic sans stack. */
  fallbacks?: Record<string, string>
}

/**
 * Build the `@font-face` rules + the `:root` family-variable mapping for a set of active typefaces.
 * Pure (no IO) so it's easy to test; {@link DevFonts} wraps it with the CMS read. The family
 * variables (`--font-setSans`, …) point at each typeface's served family, so the same
 * `font-family: var(--font-setSans)` your app uses in production resolves identically in dev.
 */
export function buildFontFaceCss(typefaces: ActiveTypeface[], opts: BuildFontFaceCssOptions = {}): string {
  const cssVarPrefix = opts.cssVarPrefix ?? '--font-set'
  const optimizedSlug = opts.optimizedSlug ?? 'fontOptimized'
  const fallbackFor = (family: FontFamily) => opts.fallbacks?.[family] ?? GENERIC_FALLBACK[family] ?? DEFAULT_FALLBACK
  if (!typefaces.length) return ''

  const faces = typefaces
    .flatMap((tf) =>
      tf.faces.map((f) => {
        // An italic with an oblique angle rides a `slnt` axis: `font-style: oblique <angle>`
        // maps onto it per CSS Fonts 4 (as `font-style: italic` maps onto an `ital` axis), and
        // italic requests fall back to oblique faces in font matching.
        const fontStyle = f.style === 'italic' && f.obliqueAngle ? `oblique ${f.obliqueAngle}deg` : f.style
        return `@font-face{font-family:'pl-font-${tf.id}';src:url('${faceUrl(f.filename, optimizedSlug)}') format('woff2');font-weight:${f.weight};font-style:${fontStyle};font-display:swap;}`
      }),
    )
    .join('')
  const vars = typefaces.map((tf) => `${cssVarPrefix}${familyVarSuffix(tf.family)}:'pl-font-${tf.id}',${fallbackFor(tf.family)};`).join('')
  return `${faces}:root{${vars}}`
}
