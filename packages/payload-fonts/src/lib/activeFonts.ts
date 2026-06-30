import type { CollectionSlug, GlobalSlug, Payload } from 'payload'

import { refId } from './refs'
import { DEFAULT_FONT_ROLES, roleVarSuffix } from './roles'

/** A role key. `sans`/`serif`/`mono`/`display` by default, but any string when customised. */
export type FontRole = string
/** Default role keys, used when {@link getActiveFontFaces} isn't given an explicit `roles` list. */
export const FONT_ROLES: FontRole[] = DEFAULT_FONT_ROLES.map((r) => r.key)

/** One served, subsetted WOFF2 file (a `fontOptimized` doc). */
export interface ActiveFace {
  filename: string
  /** A single CSS weight ('400') or a variable range ('100 900'). */
  weight: string
  style: 'normal' | 'italic'
}

/** The typeface active for a role, plus its served faces. */
export interface ActiveTypeface {
  role: FontRole
  id: string | number
  faces: ActiveFace[]
}

export interface GetActiveFontFacesOptions {
  /** Slug of the standalone font-selection global. @default 'fontSet' */
  fontSetSlug?: string
  /** Slug of the optimized (served) upload collection. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Role keys to read from the selection. @default sans/serif/mono/display */
  roles?: FontRole[]
}

/**
 * Resolve the active `fontSet` selection to each role's served `fontOptimized` files. Used by the
 * {@link DevFonts} component (and available for custom font-serving) to build `@font-face` rules
 * from CMS data at runtime. Returns `[]` if no global / no selection.
 */
export async function getActiveFontFaces(payload: Payload, opts: GetActiveFontFacesOptions = {}): Promise<ActiveTypeface[]> {
  const fontSetSlug = (opts.fontSetSlug ?? 'fontSet') as GlobalSlug
  const optimizedSlug = (opts.optimizedSlug ?? 'fontOptimized') as CollectionSlug
  const roles = opts.roles ?? FONT_ROLES

  let selection: Partial<Record<FontRole, unknown>>
  try {
    // `as unknown as` — in a project with generated types findGlobal resolves to the concrete
    // fontSet interface, which doesn't structurally overlap a string-keyed record.
    selection = (await payload.findGlobal({ slug: fontSetSlug, depth: 0, overrideAccess: true })) as unknown as Partial<
      Record<FontRole, unknown>
    >
  } catch {
    return [] // fontSet global not registered
  }

  // Resolve each role's selected typeface id once, then fetch every role's served files in a
  // single query (grouped by typeface) rather than one round-trip per role.
  const roleIds = roles
    .map((role) => ({ role, id: refId(selection?.[role]) }))
    .filter((r): r is { role: FontRole; id: string | number } => r.id != null)
  if (!roleIds.length) return []

  const uniqueIds = [...new Set(roleIds.map((r) => r.id))]
  const res = await payload.find({ collection: optimizedSlug, where: { font: { in: uniqueIds } }, depth: 0, limit: 1000, overrideAccess: true })

  const facesByFont = new Map<string | number, ActiveFace[]>()
  for (const d of res.docs as unknown as Array<Record<string, unknown>>) {
    if (typeof d.filename !== 'string') continue
    const fontId = refId(d.font)
    if (fontId == null) continue
    const face: ActiveFace = { filename: d.filename, weight: (d.weight as string) || '400', style: d.style === 'italic' ? 'italic' : 'normal' }
    const bucket = facesByFont.get(fontId)
    if (bucket) bucket.push(face)
    else facesByFont.set(fontId, [face])
  }

  const out: ActiveTypeface[] = []
  for (const { role, id } of roleIds) {
    const faces = facesByFont.get(id)
    if (faces?.length) out.push({ role, id, faces })
  }
  return out
}

/** Generic CSS fallback stack for the built-in roles, appended after the served family in the
 *  role variable. Overridable per role via {@link BuildFontFaceCssOptions.fallbacks}. */
const GENERIC_FALLBACK: Record<string, string> = Object.fromEntries(DEFAULT_FONT_ROLES.map((r) => [r.key, r.fallback]))
/** Used for a custom role with no declared fallback. */
const DEFAULT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

/** Payload serves an upload file at `/api/<slug>/file/<filename>` (public read on `fontOptimized`). */
const faceUrl = (filename: string, slug: string) => `/api/${slug}/file/${encodeURIComponent(filename)}`

export interface BuildFontFaceCssOptions {
  /** Prefix for the emitted CSS role variables; the capitalised role is appended (`--font-setSans`).
   *  Must match the download CLI's `cssVariablePrefix`. @default '--font-set' */
  cssVarPrefix?: string
  /** Slug used to build the served file URL. @default 'fontOptimized' */
  optimizedSlug?: string
  /** Per-role CSS fallback stack override (`{ brand: 'Georgia, serif' }`). Falls back to the
   *  built-in role defaults, then a generic sans stack. */
  fallbacks?: Record<string, string>
}

/**
 * Build the `@font-face` rules + the `:root` role-variable mapping for a set of active typefaces.
 * Pure (no IO) so it's easy to test; {@link DevFonts} wraps it with the CMS read. The role
 * variables (`--font-setSans`, …) point at each typeface's served family, so the same
 * `font-family: var(--font-setSans)` your app uses in production resolves identically in dev.
 */
export function buildFontFaceCss(typefaces: ActiveTypeface[], opts: BuildFontFaceCssOptions = {}): string {
  const cssVarPrefix = opts.cssVarPrefix ?? '--font-set'
  const optimizedSlug = opts.optimizedSlug ?? 'fontOptimized'
  const fallbackFor = (role: FontRole) => opts.fallbacks?.[role] ?? GENERIC_FALLBACK[role] ?? DEFAULT_FALLBACK
  if (!typefaces.length) return ''

  const faces = typefaces
    .flatMap((tf) =>
      tf.faces.map(
        (f) =>
          `@font-face{font-family:'pl-font-${tf.id}';src:url('${faceUrl(f.filename, optimizedSlug)}') format('woff2');font-weight:${f.weight};font-style:${f.style};font-display:swap;}`,
      ),
    )
    .join('')
  const vars = typefaces.map((tf) => `${cssVarPrefix}${roleVarSuffix(tf.role)}:'pl-font-${tf.id}',${fallbackFor(tf.role)};`).join('')
  return `${faces}:root{${vars}}`
}
