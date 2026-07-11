/** The BlurHash codec primitives: coefficient grids and a parsed hash. */

/** One RGB coefficient (linear space). */
export type Coefficient = [number, number, number]

export interface ParsedBlurhash {
  cx: number
  cy: number
  /** Row-major `coeffs[j][i]`, `[0][0]` is DC. Linear RGB. */
  coeffs: Coefficient[][]
}

/** A linear-RGB pixel grid: `pixels[t][s]` = [r,g,b], row-major. */
export type LinearGrid = Coefficient[][]
