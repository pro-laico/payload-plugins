import type { CollectionSlug, GlobalSlug, Payload } from 'payload'

export type FontRole = 'sans' | 'serif' | 'mono' | 'display'
export const FONT_ROLES: FontRole[] = ['sans', 'serif', 'mono', 'display']

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

const refId = (v: unknown): string | number | undefined =>
  v && typeof v === 'object' ? (v as { id?: string | number }).id : (v as string | number | undefined)

export interface GetActiveFontFacesOptions {
  /** Slug of the standalone font-selection global. @default 'fontSet' */
  fontSetSlug?: string
  /** Slug of the optimized (served) upload collection. @default 'fontOptimized' */
  optimizedSlug?: string
}

/**
 * Resolve the active `fontSet` selection to each role's served `fontOptimized` files. Used by the
 * {@link DevFonts} component (and available for custom font-serving) to build `@font-face` rules
 * from CMS data at runtime. Returns `[]` if no global / no selection.
 */
export async function getActiveFontFaces(payload: Payload, opts: GetActiveFontFacesOptions = {}): Promise<ActiveTypeface[]> {
  const fontSetSlug = (opts.fontSetSlug ?? 'fontSet') as GlobalSlug
  const optimizedSlug = (opts.optimizedSlug ?? 'fontOptimized') as CollectionSlug

  let selection: Partial<Record<FontRole, unknown>>
  try {
    selection = (await payload.findGlobal({ slug: fontSetSlug, depth: 0, overrideAccess: true })) as Partial<Record<FontRole, unknown>>
  } catch {
    return [] // fontSet global not registered
  }

  const out: ActiveTypeface[] = []
  for (const role of FONT_ROLES) {
    const id = refId(selection?.[role])
    if (id == null) continue
    const res = await payload.find({ collection: optimizedSlug, where: { font: { equals: id } }, depth: 0, limit: 100, overrideAccess: true })
    const faces = (res.docs as unknown as Array<Record<string, unknown>>)
      .filter((d): d is Record<string, unknown> & { filename: string } => typeof d.filename === 'string')
      .map(
        (d): ActiveFace => ({
          filename: d.filename,
          weight: (d.weight as string) || '400',
          style: d.style === 'italic' ? 'italic' : 'normal',
        }),
      )
    if (faces.length) out.push({ role, id, faces })
  }
  return out
}

/** Generic CSS fallback stack per role, appended after the served family in the role variable. */
const GENERIC_FALLBACK: Record<FontRole, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, monospace',
  display: 'ui-serif, Georgia, serif',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** Payload serves an upload file at `/api/<slug>/file/<filename>` (public read on `fontOptimized`). */
const faceUrl = (filename: string, slug: string) => `/api/${slug}/file/${encodeURIComponent(filename)}`

export interface BuildFontFaceCssOptions {
  /** Prefix for the emitted CSS role variables; the capitalised role is appended (`--font-setSans`).
   *  Must match the download CLI's `cssVariablePrefix`. @default '--font-set' */
  cssVarPrefix?: string
  /** Slug used to build the served file URL. @default 'fontOptimized' */
  optimizedSlug?: string
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
  if (!typefaces.length) return ''

  const faces = typefaces
    .flatMap((tf) =>
      tf.faces.map(
        (f) =>
          `@font-face{font-family:'pl-font-${tf.id}';src:url('${faceUrl(f.filename, optimizedSlug)}') format('woff2');font-weight:${f.weight};font-style:${f.style};font-display:swap;}`,
      ),
    )
    .join('')
  const vars = typefaces.map((tf) => `${cssVarPrefix}${cap(tf.role)}:'pl-font-${tf.id}',${GENERIC_FALLBACK[tf.role]};`).join('')
  return `${faces}:root{${vars}}`
}
