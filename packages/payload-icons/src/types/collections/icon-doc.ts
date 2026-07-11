/** Minimal shape of a stored icon doc — the upload fields plus the optimizer's output. */
export interface IconDoc {
  id: string | number
  filename?: string | null
  /** The optimized, sanitized `<svg>…</svg>` string, inlined by the `<Icon>` component. */
  svgString?: string | null
  /** Human-readable optimization report (e.g. "SVG optimized: 1234 to 567 bytes (54.1% reduction)"). */
  optimized?: string | null
}
