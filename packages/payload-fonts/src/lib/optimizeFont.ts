import { isRecord } from './isRecord'
import type { Charset, FontFileMetadata, FontkitFont, SubsetFontFn } from '../types'

const CHARSET_PRESETS: Record<string, Array<[number, number]>> = {
  latin: [
    [0x20, 0x7e],
    [0xa0, 0xff],
    [0x2010, 0x2014],
    [0x2018, 0x201f],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x20ac, 0x20ac],
    [0x2122, 0x2122],
  ],
  'latin-ext': [
    [0x20, 0x7e],
    [0xa0, 0xff],
    [0x100, 0x24f],
    [0x2010, 0x2014],
    [0x2018, 0x201f],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x20ac, 0x20ac],
    [0x2122, 0x2122],
  ],
}

const rangesToText = (ranges: Array<[number, number]>): string => {
  let text = ''
  for (const [start, end] of ranges) for (let cp = start; cp <= end; cp++) text += String.fromCodePoint(cp)
  return text
}

export const resolveCharsetText = (charset: Charset = 'latin'): string => {
  const preset = CHARSET_PRESETS[charset]
  return preset ? rangesToText(preset) : charset
}

const normalizeWeight = (weight?: number): string | undefined => {
  if (!weight || Number.isNaN(weight)) return undefined
  return String(Math.min(900, Math.max(100, Math.round(weight / 100) * 100)))
}

export async function detectMetadata(buffer: Buffer): Promise<FontFileMetadata | null> {
  try {
    const mod: unknown = await import('fontkit')
    const modRec = isRecord(mod) ? mod : {}
    const defaultRec = isRecord(modRec.default) ? modRec.default : {}
    const create = typeof modRec.create === 'function' ? modRec.create : typeof defaultRec.create === 'function' ? defaultRec.create : null
    if (!create) return null
    const font: FontkitFont = create(buffer)
    const italic = Boolean(
      (typeof font.italicAngle === 'number' && font.italicAngle !== 0) ||
        (font['OS/2']?.fsSelection ?? 0) & 0x01 ||
        /italic|oblique/i.test(font.subfamilyName ?? ''),
    )
    const wght = font.variationAxes?.wght
    const weight = wght ? `${Math.round(wght.min)} ${Math.round(wght.max)}` : normalizeWeight(font['OS/2']?.usWeightClass)

    let italCapable: boolean | undefined
    let obliqueAngle: number | undefined
    if (!italic) {
      const ital = font.variationAxes?.ital
      const slnt = font.variationAxes?.slnt
      if (ital && ital.max >= 1) italCapable = true
      else if (slnt && slnt.min < 0) {
        italCapable = true
        obliqueAngle = Math.round(Math.abs(slnt.min))
      }
    }

    return {
      familyName: font.familyName ?? undefined,
      weight,
      style: italic ? 'italic' : 'normal',
      isVariable: Boolean(wght),
      ...(italCapable ? { italCapable } : {}),
      ...(obliqueAngle ? { obliqueAngle } : {}),
    }
  } catch {
    return null
  }
}

export async function subsetToWoff2(buffer: Buffer, charsetText: string): Promise<Buffer> {
  //EXCUSE: subset-font's default export is an untyped/mismatched function shape versus our SubsetFontFn
  const subsetFont = (await import('subset-font')).default as unknown as SubsetFontFn
  return subsetFont(buffer, charsetText, { targetFormat: 'woff2' })
}

export const isSubsetterLoadError = (err: unknown): boolean => {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  return (
    /(hb-subset\.wasm|harfbuzzjs|subset-font|fontkit)/i.test(msg) &&
    /(ENOENT|no such file|cannot find module|failed to load|MODULE_NOT_FOUND)/i.test(msg)
  )
}

export async function probeSubsetter(): Promise<unknown | null> {
  try {
    await subsetToWoff2(Buffer.from('not a font'), 'a')
  } catch (err) {
    if (isSubsetterLoadError(err)) return err
  }
  return null
}
