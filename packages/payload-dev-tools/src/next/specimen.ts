import type { OptimizedFace, SpecimenStyle } from '../types'

export const facesToStyles = (faces: OptimizedFace[]): SpecimenStyle[] => {
  const hasExplicitItalic = faces.some((f) => f.style === 'italic')
  return (['normal', 'italic'] as const).flatMap((style) => {
    const own = faces.filter((f) => (f.style ?? 'normal') === style)
    if (style === 'italic' && !hasExplicitItalic) own.push(...faces.filter((f) => (f.style ?? 'normal') === 'normal' && f.italCapable))
    if (!own.length) return []
    const variable = own.find((f) => f.isVariable && f.weight?.includes(' '))
    if (variable?.weight) {
      const [rawMin, rawMax] = variable.weight.split(' ').map(Number)
      const min = rawMin ?? 400
      const max = rawMax ?? min
      const stops = new Set<number>([min])
      for (let w = Math.ceil(min / 100) * 100; w <= max; w += 100) stops.add(w)
      stops.add(max)
      return [{ style, label: `variable · ${min}–${max}`, weights: [...stops].sort((a, b) => a - b) }]
    }
    const weights = [...new Set(own.map((f) => Number(f.weight)).filter((w) => Number.isFinite(w)))].sort((a, b) => a - b)
    if (!weights.length) return []
    return [{ style, label: `${weights.length} weight${weights.length === 1 ? '' : 's'}`, weights }]
  })
}
