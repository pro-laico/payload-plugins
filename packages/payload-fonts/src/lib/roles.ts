/**
 * The font *roles* (slots) the plugin exposes — `sans / serif / mono / display` by default,
 * but fully replaceable/extendable via `fontsPlugin({ roles })`. A role flows through the whole
 * stack: it's an option on the `font` collection's `family` field, a relationship slot on the
 * `fontSet` global, a key in the `/api/fonts/export` JSON, a generated `next/font/local` export
 * (`font<Key>`), and a CSS role variable (`--font-set<Key>`). Centralised here so every consumer
 * resolves the SAME list and naming.
 */

/** A role as the consumer declares it. Only `key` is required; the rest default by convention. */
export interface FontRoleConfig {
  /** Stable identifier. Used as the `family` value, the `fontSet` slot name, the export JSON key,
   *  and (capitalised) the generated `font<Key>` export + `--font-set<Key>` CSS variable. */
  key: string
  /** Admin label for the `family` radio option and the `fontSet` slot. @default capitalised `key` */
  label?: string
  /** CSS fallback stack appended after the served family in the role variable (dev preview /
   *  custom serving). @default `'ui-sans-serif, system-ui, sans-serif'` */
  fallback?: string
}

/** A role with every field resolved — what the internals actually consume. */
export interface ResolvedFontRole {
  key: string
  label: string
  fallback: string
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Generic CSS fallback for a role with none declared. */
const DEFAULT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

/** The built-in roles, used when `fontsPlugin` is called without `roles`. */
export const DEFAULT_FONT_ROLES: ResolvedFontRole[] = [
  { key: 'sans', label: 'Sans', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  { key: 'serif', label: 'Serif', fallback: 'ui-serif, Georgia, serif' },
  { key: 'mono', label: 'Mono', fallback: 'ui-monospace, SFMono-Regular, monospace' },
  { key: 'display', label: 'Display', fallback: 'ui-serif, Georgia, serif' },
]

/**
 * Resolve a `roles` option to a complete list — applying the convention defaults (label =
 * capitalised key, fallback = generic sans stack). Passing `undefined` yields {@link
 * DEFAULT_FONT_ROLES}; passing `[]` is the caller's explicit choice of no roles.
 */
export const resolveFontRoles = (roles?: FontRoleConfig[]): ResolvedFontRole[] =>
  roles === undefined
    ? DEFAULT_FONT_ROLES
    : roles.map((r) => ({ key: r.key, label: r.label ?? cap(r.key), fallback: r.fallback ?? DEFAULT_FALLBACK }))

/** Generated `next/font/local` export name for a role key (`sans` → `fontSans`). */
export const roleExportName = (key: string): string => `font${cap(key)}`

/** CSS role-variable suffix for a role key (`sans` → `Sans`, used as `<prefix>Sans`). */
export const roleVarSuffix = (key: string): string => cap(key)
