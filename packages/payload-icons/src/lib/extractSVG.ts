export const extractSvgContent = (svgString: string): string => svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] || svgString

const DROP_PROPS = /^(?:xmlns(?::.+)?|xml:.+|version|enable-background)$/i

const toReactProp = (key: string): string =>
  /^(?:data|aria)-/i.test(key) ? key : key.replace(/[-:]([a-z])/gi, (_, ch: string) => ch.toUpperCase())

export const extractSvgProps = (svgString: string): Record<string, string> => {
  const match = svgString.match(/<svg([^>]*)>/i)
  if (!match?.[1]) return {}
  const props: Record<string, string> = {}
  for (const [, key, dq, sq] of match[1].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (key && !DROP_PROPS.test(key)) props[toReactProp(key)] = dq ?? sq ?? ''
  }
  return props
}
