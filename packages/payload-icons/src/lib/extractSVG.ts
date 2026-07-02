// Pull the inner markup out of an `<svg>` wrapper so the `<Icon>` component can re-emit it
// inside its own `<svg>` (props merged from the JSX node). Lazy `*?` so a (valid) nested
// `<svg>` doesn't make the match run to the outer document's last `</svg>` and swallow the
// inner closing tag.
export const extractSvgContent = (svgString: string): string => svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] || svgString

/** Root attributes that are useless on an inlined `<svg>` AND unsafe to spread onto a React
 *  element: React rejects namespaced names, and `xmlns`/`version`/`enable-background` mean
 *  nothing inline. */
const DROP_PROPS = /^(?:xmlns(?::.+)?|xml:.+|version|enable-background)$/i

/** React's SVG props are camelCase (`fill-rule` → `fillRule`, `xlink:href` → `xlinkHref`) —
 *  spreading the raw hyphenated/namespaced names triggers "Invalid DOM property" errors.
 *  `data-*` / `aria-*` are the exception: React expects those verbatim. */
const toReactProp = (key: string): string =>
  /^(?:data|aria)-/i.test(key) ? key : key.replace(/[-:]([a-z])/gi, (_, ch: string) => ch.toUpperCase())

// Parse the attributes off the opening `<svg …>` tag into a React-safe props object (viewBox,
// fill, fillRule, …), so the rendered element keeps the source's intrinsic attributes unless a
// JSX prop overrides them.
export const extractSvgProps = (svgString: string): Record<string, string> => {
  const match = svgString.match(/<svg([^>]*)>/i)
  if (!match?.[1]) return {}
  const props: Record<string, string> = {}
  // Allow namespaced/hyphenated attribute names (`xmlns:xlink`, `fill-rule`, `xml:space`,
  // `stroke-width`) and both single- and double-quoted values.
  for (const [, key, dq, sq] of match[1].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (key && !DROP_PROPS.test(key)) props[toReactProp(key)] = dq ?? sq ?? ''
  }
  return props
}
