export type Coefficient = [number, number, number]

export interface ParsedBlurhash {
  cx: number
  cy: number
  coeffs: Coefficient[][]
}

export type LinearGrid = Coefficient[][]
