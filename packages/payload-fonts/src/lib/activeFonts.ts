import type { Payload } from 'payload'

import { refId } from './refs'
import { isRecord } from './isRecord'
import { DEFAULT_FONT_FAMILIES, familyVarSuffix } from './families'
import type { ActiveFace, ActiveTypeface, BuildFontFaceCssOptions, FontFamily, GetActiveFontFacesOptions, RawFace } from '../types'

export function expandItalCapableFaces(faces: RawFace[]): ActiveFace[] {
  const hasExplicitItalic = faces.some((f) => f.style === 'italic')
  return faces.flatMap(({ italCapable, ...face }) => {
    const { obliqueAngle: _drop, ...upright } = face
    if (face.style === 'normal' && italCapable && !hasExplicitItalic) {
      return [upright, { ...face, style: 'italic' as const }]
    }
    return [face.style === 'normal' ? upright : face]
  })
}

const GLOBAL_META_KEYS = new Set(['id', 'globalType', 'createdAt', 'updatedAt'])
const familyKeysFromGlobal = (global: Record<string, unknown> | null | undefined): FontFamily[] =>
  global ? Object.keys(global).filter((k) => !k.startsWith('_') && !GLOBAL_META_KEYS.has(k)) : []

export async function getActiveFontFaces(payload: Payload, opts: GetActiveFontFacesOptions = {}): Promise<ActiveTypeface[]> {
  const fontSetSlug = opts.fontSetSlug ?? 'fontSet'
  const optimizedSlug = opts.optimizedSlug ?? 'fontOptimized'

  let selection: Record<string, unknown> = {}
  try {
    const global = await payload.findGlobal({ slug: fontSetSlug, depth: 0 })
    selection = isRecord(global) ? global : {}
  } catch {
    return []
  }

  const families = opts.families ?? familyKeysFromGlobal(selection)

  const familyIds = families
    .map((family) => ({ family, id: refId(selection?.[family]) }))
    .filter((r): r is { family: FontFamily; id: string | number } => r.id != null)
  if (!familyIds.length) return []

  const uniqueIds = [...new Set(familyIds.map((r) => r.id))]
  const res = await payload.find({ collection: optimizedSlug, where: { font: { in: uniqueIds } }, depth: 0, limit: 1000 })

  const facesByFont = new Map<string | number, RawFace[]>()
  for (const d of res.docs) {
    if (typeof d.filename !== 'string') continue
    const fontId = refId(d.font)
    if (fontId == null) continue
    const face: RawFace = {
      filename: d.filename,
      weight: (typeof d.weight === 'string' ? d.weight : '') || '400',
      style: d.style === 'italic' ? 'italic' : 'normal',
      ...(d.italCapable ? { italCapable: true } : {}),
      ...(typeof d.obliqueAngle === 'number' ? { obliqueAngle: d.obliqueAngle } : {}),
    }
    const bucket = facesByFont.get(fontId)
    if (bucket) bucket.push(face)
    else facesByFont.set(fontId, [face])
  }

  const out: ActiveTypeface[] = []
  for (const { family, id } of familyIds) {
    const faces = facesByFont.get(id)
    if (faces?.length) out.push({ family, id, faces: expandItalCapableFaces(faces) })
  }
  return out
}

const GENERIC_FALLBACK: Record<string, string> = Object.fromEntries(DEFAULT_FONT_FAMILIES.map((r) => [r.key, r.fallback]))
const DEFAULT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

const faceUrl = (filename: string, slug: string) => `/api/${slug}/file/${encodeURIComponent(filename)}`

export function buildFontFaceCss(typefaces: ActiveTypeface[], opts: BuildFontFaceCssOptions = {}): string {
  const cssVarPrefix = opts.cssVarPrefix ?? '--font-set'
  const optimizedSlug = opts.optimizedSlug ?? 'fontOptimized'
  const fallbackFor = (family: FontFamily) => opts.fallbacks?.[family] ?? GENERIC_FALLBACK[family] ?? DEFAULT_FALLBACK
  if (!typefaces.length) return ''

  const faces = typefaces
    .flatMap((tf) =>
      tf.faces.map((f) => {
        const fontStyle = f.style === 'italic' && f.obliqueAngle ? `oblique ${f.obliqueAngle}deg` : f.style
        return `@font-face{font-family:'pl-font-${tf.id}';src:url('${faceUrl(f.filename, optimizedSlug)}') format('woff2');font-weight:${f.weight};font-style:${fontStyle};font-display:swap;}`
      }),
    )
    .join('')
  const vars = typefaces.map((tf) => `${cssVarPrefix}${familyVarSuffix(tf.family)}:'pl-font-${tf.id}',${fallbackFor(tf.family)};`).join('')
  return `${faces}:root{${vars}}`
}
