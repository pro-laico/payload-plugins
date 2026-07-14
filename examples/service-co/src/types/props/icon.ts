export type IconSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl'
export type IconVariant = 'standalone' | 'inline' | 'outline' | 'solid' | 'ghost'
export type IconTone = 'current' | 'muted' | 'primary' | 'accent' | 'destructive'

export interface IconProps {
  /** The icon's optimized `<svg>` string (an icon doc's `svgString`). Renders nothing if missing. */
  svg?: string | null
  variant?: IconVariant
  size?: IconSize
  tone?: IconTone
  className?: string
}
