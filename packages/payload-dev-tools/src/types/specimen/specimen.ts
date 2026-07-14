export type SpecimenStyle = { style: 'normal' | 'italic'; label: string; weights: number[] }

export type OptimizedFace = {
  font?: string | number | null
  weight?: string | null
  style?: 'normal' | 'italic' | null
  isVariable?: boolean | null
  italCapable?: boolean | null
}
