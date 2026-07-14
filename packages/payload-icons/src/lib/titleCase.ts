export const toKebabCase = (input?: string | null): string => {
  if (!input) return ''
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export const toTitleCase = (input?: string | null): string => {
  if (!input) return ''
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
