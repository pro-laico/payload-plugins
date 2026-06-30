// Pull the inner markup out of an `<svg>` wrapper so the `<Icon>` component can re-emit it
// inside its own `<svg>` (props merged from the JSX node). Lazy `*?` so a (valid) nested
// `<svg>` doesn't make the match run to the outer document's last `</svg>` and swallow the
// inner closing tag.
export const extractSvgContent = (svgString: string): string => svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] || svgString

// Parse the attributes off the opening `<svg …>` tag into a props object (viewBox, fill, etc.),
// so the rendered element keeps the source's intrinsic attributes unless a JSX prop overrides them.
export const extractSvgProps = (svgString: string): Record<string, string> => {
  const match = svgString.match(/<svg([^>]*)>/i)
  if (!match?.[1]) return {}
  const props: Record<string, string> = {}
  // Allow namespaced/hyphenated attribute names (`xmlns:xlink`, `fill-rule`, `xml:space`,
  // `stroke-width`) and both single- and double-quoted values.
  for (const [, key, dq, sq] of match[1].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (key) props[key] = dq ?? sq ?? ''
  }
  return props
}
