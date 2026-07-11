import type { IconSize, IconTone, IconVariant } from './icon-style'

/** Props for the presentational, CVA-styled `Icon` that inlines an already-fetched `svg` string. */
export interface IconProps {
  /** The icon's optimized `<svg>` string (an icon doc's `svgString`). Renders nothing if missing. */
  svg?: string | null
  variant?: IconVariant
  size?: IconSize
  tone?: IconTone
  className?: string
}
