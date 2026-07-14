import type { FontDefinitions } from './types'

export function extractFonts(definitionFonts: FontDefinitions): string | undefined {
  const variables = Object.values(definitionFonts)
    .map((font) => font?.variable)
    .filter(Boolean)
    .join(' ')
  return variables || undefined
}
