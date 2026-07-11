/** The subset of an icon doc the SVG-format hook writes. */
export type IconData = Record<string, unknown> & { filesize?: number; optimized?: string; svgString?: string }
