/** The fit / output-format primitives for the on-demand transform endpoint. */

export type Fit = 'cover' | 'contain' | 'inside' | 'outside' | 'fill'
export type Format = 'auto' | 'avif' | 'webp' | 'jpeg' | 'png'
/** A concrete output format (never `auto`). */
export type OutputFormat = Exclude<Format, 'auto'>
