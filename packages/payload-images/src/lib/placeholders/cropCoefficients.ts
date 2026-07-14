import { encodeCoefficients, parseBlurhash } from './codec'
import type { Coefficient, CropCoefficientsOptions, CropWindow, ParsedBlurhash } from '../../types'

const cosIntegral = (alpha: number, delta: number): number =>
  Math.abs(delta) < 1e-9 ? Math.cos(alpha) : (Math.sin(alpha + delta) - Math.sin(alpha)) / delta

const overlapMatrix = (outN: number, inN: number, a: number, w: number): number[][] =>
  Array.from({ length: outN }, (_, k) =>
    Array.from({ length: inN }, (_, i) => {
      const alpha = Math.PI * i * a
      const beta = Math.PI * i * w
      const gamma = Math.PI * k
      const integral = (cosIntegral(alpha, beta - gamma) + cosIntegral(alpha, beta + gamma)) / 2
      return (k === 0 ? 1 : 2) * integral
    }),
  )

export const cropBlurhashCoefficients = (hash: string, window: CropWindow, opts: CropCoefficientsOptions = {}): string =>
  encodeCoefficients(projectCoefficients(parseBlurhash(hash), window, opts))

export const projectCoefficients = (parsed: ParsedBlurhash, window: CropWindow, opts: CropCoefficientsOptions = {}): ParsedBlurhash => {
  const { cx, cy, coeffs } = parsed
  const outCx = opts.cx ?? cx
  const outCy = opts.cy ?? cy
  const mx = overlapMatrix(outCx, cx, window.x0, window.w)
  const my = overlapMatrix(outCy, cy, window.y0, window.h)

  const temp: Coefficient[][] = Array.from({ length: cy }, (_, j) =>
    Array.from({ length: outCx }, (_, k): Coefficient => {
      let r = 0
      let g = 0
      let b = 0
      for (let i = 0; i < cx; i++) {
        const m = mx[k]![i]!
        const c = coeffs[j]![i]!
        r += c[0] * m
        g += c[1] * m
        b += c[2] * m
      }
      return [r, g, b]
    }),
  )
  const out: Coefficient[][] = Array.from({ length: outCy }, (_, l) =>
    Array.from({ length: outCx }, (_, k): Coefficient => {
      let r = 0
      let g = 0
      let b = 0
      for (let j = 0; j < cy; j++) {
        const m = my[l]![j]!
        const t = temp[j]![k]!
        r += t[0] * m
        g += t[1] * m
        b += t[2] * m
      }
      return [r, g, b]
    }),
  )
  return { cx: outCx, cy: outCy, coeffs: out }
}
