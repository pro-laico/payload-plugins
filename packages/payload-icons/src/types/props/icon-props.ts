import type React from 'react'

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /**
   * Icon name as defined in the active `iconSet`'s `iconsArray` (each entry's
   * `name` field). Resolved server-side through the active set, so swapping the
   * active set re-skins every icon.
   */
  name: string
  /**
   * Optional fallback SVG string used when `name` doesn't match any icon in the
   * active set. Defaults to a small inline warning glyph.
   */
  fallback?: string
}
