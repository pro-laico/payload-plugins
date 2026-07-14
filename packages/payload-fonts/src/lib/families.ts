import type { FontFamilyConfig, ResolvedFontFamily } from '../types'

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

const DEFAULT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

export const DEFAULT_FONT_FAMILIES: ResolvedFontFamily[] = [
  { key: 'sans', label: 'Sans', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  { key: 'serif', label: 'Serif', fallback: 'ui-serif, Georgia, serif' },
  { key: 'mono', label: 'Mono', fallback: 'ui-monospace, SFMono-Regular, monospace' },
  { key: 'display', label: 'Display', fallback: 'ui-serif, Georgia, serif' },
]

export const resolveFontFamilies = (families?: FontFamilyConfig[]): ResolvedFontFamily[] =>
  families === undefined
    ? DEFAULT_FONT_FAMILIES
    : families.map((r) => ({ key: r.key, label: r.label ?? cap(r.key), fallback: r.fallback ?? DEFAULT_FALLBACK }))

export const familyExportName = (key: string): string => `font${cap(key)}`

export const familyVarSuffix = (key: string): string => cap(key)
