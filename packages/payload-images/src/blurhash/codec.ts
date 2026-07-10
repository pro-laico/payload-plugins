/**
 * Minimal BlurHash codec with coefficient access — pure TS, no deps, no Sharp. The npm
 * `blurhash` package only exposes pixel encode/decode; cropping in hash space needs the
 * raw DCT coefficients, so this implements the spec (https://github.com/woltapp/blurhash)
 * directly: base83, sRGB↔linear, parse → coefficient grid, encode ← coefficient grid,
 * plus pixel-grid encode/decode for ground-truth comparisons.
 *
 * A parsed hash is `{ cx, cy, coeffs }` where `coeffs[j][i]` is the linear-RGB series
 * coefficient of `cos(πi·x)·cos(πj·y)` — decode is literally `f(x,y) = Σ coeffs·cos·cos`,
 * so coefficient-space operations act on the exact function a client decoder renders.
 */

const B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
const B83_INDEX = new Map([...B83].map((c, i) => [c, i]))

const decode83 = (s: string): number => {
  let v = 0
  for (const c of s) {
    const d = B83_INDEX.get(c)
    if (d === undefined) throw new Error(`[blurhash] invalid base83 character "${c}"`)
    v = v * 83 + d
  }
  return v
}

const encode83 = (n: number, length: number): string => {
  let out = ''
  for (let i = 1; i <= length; i++) out += B83[Math.floor(n / 83 ** (length - i)) % 83]
  return out
}

export const srgbToLinear = (v: number): number => {
  const x = v / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

export const linearToSrgb = (v: number): number => {
  const x = Math.max(0, Math.min(1, v))
  return Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255)
}

const signPow = (v: number, exp: number): number => Math.sign(v) * Math.abs(v) ** exp

/** One RGB coefficient (linear space). */
export type Coefficient = [number, number, number]

export interface ParsedBlurhash {
  cx: number
  cy: number
  /** Row-major `coeffs[j][i]`, `[0][0]` is DC. Linear RGB, ready to use as series coefficients. */
  coeffs: Coefficient[][]
}

export const parseBlurhash = (hash: string): ParsedBlurhash => {
  if (hash.length < 6) throw new Error('[blurhash] hash too short')
  const sizeFlag = decode83(hash[0]!)
  const cx = (sizeFlag % 9) + 1
  const cy = Math.floor(sizeFlag / 9) + 1
  if (hash.length !== 4 + 2 * cx * cy) throw new Error(`[blurhash] invalid length ${hash.length} for ${cx}x${cy}`)
  const maxAc = (decode83(hash[1]!) + 1) / 166

  const dcValue = decode83(hash.slice(2, 6))
  const dc: Coefficient = [srgbToLinear(dcValue >> 16), srgbToLinear((dcValue >> 8) & 255), srgbToLinear(dcValue & 255)]

  const coeffs: Coefficient[][] = Array.from({ length: cy }, () => Array.from({ length: cx }, (): Coefficient => [0, 0, 0]))
  coeffs[0]![0] = dc
  for (let n = 1; n < cx * cy; n++) {
    const v = decode83(hash.slice(6 + (n - 1) * 2, 6 + (n - 1) * 2 + 2))
    const j = Math.floor(n / cx)
    const i = n % cx
    coeffs[j]![i] = [
      signPow((Math.floor(v / (19 * 19)) - 9) / 9, 2) * maxAc,
      signPow(((Math.floor(v / 19) % 19) - 9) / 9, 2) * maxAc,
      signPow(((v % 19) - 9) / 9, 2) * maxAc,
    ]
  }
  return { cx, cy, coeffs }
}

/** Quantize + serialize a coefficient grid back to a blurhash string. */
export const encodeCoefficients = ({ cx, cy, coeffs }: ParsedBlurhash): string => {
  if (cx < 1 || cx > 9 || cy < 1 || cy > 9) throw new Error(`[blurhash] components out of range: ${cx}x${cy}`)
  let out = encode83((cy - 1) * 9 + (cx - 1), 1)

  let maxAc = 0
  for (let j = 0; j < cy; j++)
    for (let i = 0; i < cx; i++) {
      if (i === 0 && j === 0) continue
      const [r, g, b] = coeffs[j]![i]!
      maxAc = Math.max(maxAc, Math.abs(r), Math.abs(g), Math.abs(b))
    }
  const qMax = Math.max(0, Math.min(82, Math.floor(maxAc * 166 - 0.5)))
  const actualMax = (qMax + 1) / 166
  out += encode83(qMax, 1)

  const dc = coeffs[0]![0]!
  out += encode83((linearToSrgb(dc[0]) << 16) + (linearToSrgb(dc[1]) << 8) + linearToSrgb(dc[2]), 4)

  const quantAc = (v: number): number => Math.max(0, Math.min(18, Math.floor(signPow(v / actualMax, 0.5) * 9 + 9.5)))
  for (let j = 0; j < cy; j++)
    for (let i = 0; i < cx; i++) {
      if (i === 0 && j === 0) continue
      const [r, g, b] = coeffs[j]![i]!
      out += encode83(quantAc(r) * 19 * 19 + quantAc(g) * 19 + quantAc(b), 2)
    }
  return out
}

/** A linear-RGB pixel grid: `pixels[t][s]` = [r,g,b], row-major. */
export type LinearGrid = Coefficient[][]

/**
 * Evaluate the hash's cosine series over a window of the unit square (midpoint sampling) —
 * `window` defaults to the full image; this IS the exact restricted blur, so it doubles as
 * the ground-truth reference for crop comparisons.
 */
export const decodeToLinearGrid = (
  { cx, cy, coeffs }: ParsedBlurhash,
  width: number,
  height: number,
  window: { x0: number; y0: number; w: number; h: number } = { x0: 0, y0: 0, w: 1, h: 1 },
): LinearGrid => {
  // Precomputed separable basis: cosX[i][s] = cos(πi·(x0 + w·(s+0.5)/W)), same for Y.
  const cosX = Array.from({ length: cx }, (_, i) =>
    Array.from({ length: width }, (_, s) => Math.cos(Math.PI * i * (window.x0 + (window.w * (s + 0.5)) / width))),
  )
  const cosY = Array.from({ length: cy }, (_, j) =>
    Array.from({ length: height }, (_, t) => Math.cos(Math.PI * j * (window.y0 + (window.h * (t + 0.5)) / height))),
  )
  // Separable evaluation (two passes): rows[t][i] = Σⱼ coeffs[j][i]·cosY[j][t], then
  // out[t][s] = Σᵢ rows[t][i]·cosX[i][s] — O(H·cy·cx + H·W·cx) instead of O(H·W·cx·cy),
  // which is what makes the extended high-component tiers renderable in milliseconds.
  const grid: LinearGrid = []
  const rowCoef = new Float64Array(cx * 3)
  for (let t = 0; t < height; t++) {
    rowCoef.fill(0)
    for (let j = 0; j < cy; j++) {
      const cy_ = cosY[j]![t]!
      for (let i = 0; i < cx; i++) {
        const c = coeffs[j]![i]!
        rowCoef[i * 3] = rowCoef[i * 3]! + c[0] * cy_
        rowCoef[i * 3 + 1] = rowCoef[i * 3 + 1]! + c[1] * cy_
        rowCoef[i * 3 + 2] = rowCoef[i * 3 + 2]! + c[2] * cy_
      }
    }
    const row: Coefficient[] = []
    for (let s = 0; s < width; s++) {
      let r = 0
      let g = 0
      let b = 0
      for (let i = 0; i < cx; i++) {
        const basis = cosX[i]![s]!
        r += rowCoef[i * 3]! * basis
        g += rowCoef[i * 3 + 1]! * basis
        b += rowCoef[i * 3 + 2]! * basis
      }
      row.push([r, g, b])
    }
    grid.push(row)
  }
  return grid
}

export interface EncodeGridOptions {
  /**
   * Use true orthogonal norms (1 / 2 / 4) instead of wolt's flat 2-for-every-AC. Wolt's
   * norm halves the both-axes AC terms on any decode→re-encode round trip (it's tuned for
   * encoding original photos once, not for round-tripping) — set this when the input grid
   * is itself a decoded blurhash, so the round trip is lossless. Default false (stock).
   */
  orthonormal?: boolean
}

/**
 * Blurhash encode from a linear pixel grid. Stock wolt normalization by default (1 for DC,
 * 2 for every AC); see {@link EncodeGridOptions.orthonormal} for round-trip-exact norms.
 * Midpoint basis sampling to match {@link decodeToLinearGrid}.
 */
export const encodeLinearGrid = (grid: LinearGrid, cx: number, cy: number, opts: EncodeGridOptions = {}): ParsedBlurhash => {
  const height = grid.length
  const width = grid[0]!.length
  const cosX = Array.from({ length: cx }, (_, i) => Array.from({ length: width }, (_, s) => Math.cos((Math.PI * i * (s + 0.5)) / width)))
  const cosY = Array.from({ length: cy }, (_, j) => Array.from({ length: height }, (_, t) => Math.cos((Math.PI * j * (t + 0.5)) / height)))
  // Separable projection (two passes): colSum[j][s] = Σₜ grid[t][s]·cosY[j][t], then
  // coeffs[j][i] = norm/(W·H) · Σₛ colSum[j][s]·cosX[i][s] — O(cy·H·W + cy·cx·W) instead
  // of O(cy·cx·H·W), making 64×64-component encodes take milliseconds, not seconds.
  const colSum = new Float64Array(cy * width * 3)
  for (let t = 0; t < height; t++) {
    const row = grid[t]!
    for (let j = 0; j < cy; j++) {
      const cy_ = cosY[j]![t]!
      const base = j * width * 3
      for (let s = 0; s < width; s++) {
        const p = row[s]!
        colSum[base + s * 3] = colSum[base + s * 3]! + p[0] * cy_
        colSum[base + s * 3 + 1] = colSum[base + s * 3 + 1]! + p[1] * cy_
        colSum[base + s * 3 + 2] = colSum[base + s * 3 + 2]! + p[2] * cy_
      }
    }
  }
  const coeffs: Coefficient[][] = []
  for (let j = 0; j < cy; j++) {
    const row: Coefficient[] = []
    const base = j * width * 3
    for (let i = 0; i < cx; i++) {
      const norm = opts.orthonormal ? (i === 0 ? 1 : 2) * (j === 0 ? 1 : 2) : i === 0 && j === 0 ? 1 : 2
      let r = 0
      let g = 0
      let b = 0
      for (let s = 0; s < width; s++) {
        const basis = cosX[i]![s]!
        r += colSum[base + s * 3]! * basis
        g += colSum[base + s * 3 + 1]! * basis
        b += colSum[base + s * 3 + 2]! * basis
      }
      const scale = norm / (width * height)
      row.push([r * scale, g * scale, b * scale])
    }
    coeffs.push(row)
  }
  return { cx, cy, coeffs }
}
