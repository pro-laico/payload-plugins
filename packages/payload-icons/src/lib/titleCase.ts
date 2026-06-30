/** Humanize a kebab/camel/snake icon name into Title Case for admin labels and
 *  select options (`arrow-right` -> `Arrow Right`). Pure string work, no deps —
 *  shared by the icon row label and the icon-select options. */
export const toTitleCase = (input?: string | null): string => {
  if (!input) return ''
  // Strip combining diacritical marks (U+0300-U+036F) left after NFKD decomposition.
  const stripped = input.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  const spaced = stripped
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/[.\s]+/g, ' ')
  const words = spaced.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return ''
  return words
    .map((w) => (/^[A-Z]+$/.test(w) ? w : /^[A-Z][a-z]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
    .trim()
}
