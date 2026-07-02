/** A served face row from the `fontOptimized` collection (depth 0). */
export type OptimizedFace = {
  font?: string | number | null
  weight?: string | null
  style?: 'normal' | 'italic' | null
  isVariable?: boolean | null
  /** payload-fonts marks an upright variable file whose axes also carry italics (ital/slnt). */
  italCapable?: boolean | null
}

/** One selectable style on the `/dev/fonts` specimen: a real served style with the weights it
 *  actually carries. Built server-side, so the controls never offer a synthesized face. */
export type SpecimenStyle = {
  style: 'normal' | 'italic'
  /** e.g. "variable · 100–900" or "3 weights" — shown next to the style toggle. */
  label: string
  weights: number[]
}

/** The served faces of one typeface → selectable specimen styles. A variable face's range
 *  (`'100 900'`) becomes clickable stops at every 100 (range ends always included); static faces
 *  list their exact weights. An upright variable face flagged `italCapable` (ital/slnt axes)
 *  contributes an italic style from the same file — unless an explicit italic exists. Styles
 *  with no faces are omitted. */
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
