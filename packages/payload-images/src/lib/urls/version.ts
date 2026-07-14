import type { VersionSource } from '../../types'

const fnv1a = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export const deriveVersion = (src?: VersionSource | null): string | undefined => {
  if (!src) return undefined
  const { filename, focalX, focalY } = src
  if (filename == null && focalX == null && focalY == null) return undefined
  const hotspot = [src.focalSize ?? 100, src.cropLeft ?? 0, src.cropTop ?? 0, src.cropRight ?? 0, src.cropBottom ?? 0]
  const suffix = hotspot[0] !== 100 || hotspot.slice(1).some((v) => v !== 0) ? `|${hotspot.join('|')}` : ''
  return fnv1a(`${filename ?? ''}|${focalX ?? ''}|${focalY ?? ''}${suffix}`)
}
