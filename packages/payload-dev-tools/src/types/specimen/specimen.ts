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
