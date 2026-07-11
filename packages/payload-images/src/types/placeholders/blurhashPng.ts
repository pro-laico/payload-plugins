/** Options for rendering a blurhash to a PNG data URI. */

export interface BlurhashPngOptions {
  /** Rendered width in px. Default 32. */
  width?: number
  /** Rendered height. Default: derived from `aspectRatio` (else square). */
  height?: number
  /** Target aspect ratio — derives `height` from the resolved width. */
  aspectRatio?: number
}
