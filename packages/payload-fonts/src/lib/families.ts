/**
 * The font *families* (slots) the plugin exposes — `sans / serif / mono / display` by default,
 * but fully replaceable/extendable via `fontsPlugin({ families })`. A family flows through the whole
 * stack: it's an option on the `font` collection's `family` field, a relationship slot on the
 * `fontSet` global, a key in the `/api/fonts/export` JSON, a generated `next/font/local` export
 * (`font<Key>`), and a CSS family variable (`--font-set<Key>`). Centralised here so every consumer
 * resolves the SAME list and naming.
 */
import type { FontFamilyConfig, ResolvedFontFamily } from '../types'

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Generic CSS fallback for a family with none declared. */
const DEFAULT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

/** The built-in families, used when `fontsPlugin` is called without `families`. */
export const DEFAULT_FONT_FAMILIES: ResolvedFontFamily[] = [
  { key: 'sans', label: 'Sans', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  { key: 'serif', label: 'Serif', fallback: 'ui-serif, Georgia, serif' },
  { key: 'mono', label: 'Mono', fallback: 'ui-monospace, SFMono-Regular, monospace' },
  { key: 'display', label: 'Display', fallback: 'ui-serif, Georgia, serif' },
]

/**
 * Resolve a `families` option to a complete list — applying the convention defaults (label =
 * capitalised key, fallback = generic sans stack). Passing `undefined` yields {@link
 * DEFAULT_FONT_FAMILIES}; passing `[]` is the caller's explicit choice of no families.
 */
export const resolveFontFamilies = (families?: FontFamilyConfig[]): ResolvedFontFamily[] =>
  families === undefined
    ? DEFAULT_FONT_FAMILIES
    : families.map((r) => ({ key: r.key, label: r.label ?? cap(r.key), fallback: r.fallback ?? DEFAULT_FALLBACK }))

/** Generated `next/font/local` export name for a family key (`sans` → `fontSans`). */
export const familyExportName = (key: string): string => `font${cap(key)}`

/** CSS family-variable suffix for a family key (`sans` → `Sans`, used as `<prefix>Sans`). */
export const familyVarSuffix = (key: string): string => cap(key)
