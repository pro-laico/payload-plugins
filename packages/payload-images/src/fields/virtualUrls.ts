/**
 * Virtual (computed, never stored) URL fields for the image doc. An `afterRead` hook builds
 * each URL from the doc's own id + dimensions + filename + focal point, so the optimized URLs
 * ride along in EVERY read — REST, GraphQL, and the Local API — and through relationship
 * population (a populated `heroImage` carries `srcset` / `placeholderURL` ready to render),
 * with no client code and no knowledge of the `/api/img` endpoint.
 *
 * URLs are absolute when `config.serverURL` is set (handy for mobile / email / OG consumers),
 * relative otherwise. The builders are pure/isomorphic, so importing them here is server-safe.
 */
import type { Field, FieldHook } from 'payload'

import { buildSrcset, buildVariantUrl, deriveVersion, getImageUrl } from '../components/buildSrcset'

interface ImageDocLike {
  id?: string | number
  width?: number | null
  height?: number | null
  filename?: string | null
  focalX?: number | null
  focalY?: number | null
}

/** Fields the virtual URLs are computed from — kept selected via the collection's `forceSelect`. */
export const VIRTUAL_URL_INPUTS = ['width', 'height', 'filename', 'focalX', 'focalY'] as const

const naturalAspectRatio = (d: ImageDocLike): number | undefined => (d.width && d.height ? d.width / d.height : undefined)

/** Build a single virtual `text` field from a `(doc, baseUrl) => url` computer. */
const virtualUrl = (
  name: string,
  description: string,
  compute: (doc: ImageDocLike, baseUrl?: string, pixelStep?: number | number[]) => string | null,
): Field => {
  const afterRead: FieldHook = ({ data, req }) => {
    const doc = (data ?? {}) as ImageDocLike
    if (doc.id == null || !doc.filename) return null
    const cfg = req?.payload?.config
    const baseUrl = cfg?.serverURL || undefined
    const pixelStep = (cfg?.custom?.payloadImages as { pixelStep?: number | number[] } | undefined)?.pixelStep
    return compute(doc, baseUrl, pixelStep)
  }
  return { name, type: 'text', virtual: true, admin: { hidden: true, description }, hooks: { afterRead: [afterRead] } }
}

/**
 * The virtual URL fields appended to the image collection:
 *  - `src` — a single optimized URL (capped at 1280px) for a plain `<img>` / OG tag.
 *  - `srcset` — a responsive srcset at the image's natural ratio, stepped up to its width.
 *  - `placeholderURL` — the tiny LQIP (32px, q40) for a blur-up / CSS background.
 *  - `thumbnailURL` — a 160px focal-cropped square for cards, lists, and feeds.
 */
export const virtualUrlFields = (): Field[] => [
  virtualUrl('src', 'Optimized URL (≤1280px) for a plain <img> or OG tag.', (d, baseUrl) =>
    getImageUrl(
      { id: d.id as string | number, width: d.width, filename: d.filename, focalX: d.focalX, focalY: d.focalY },
      {
        width: Math.min(d.width ?? 1280, 1280),
        baseUrl,
      },
    ),
  ),
  virtualUrl(
    'srcset',
    'Responsive srcset at the natural ratio, up to the source width.',
    (d, baseUrl, pixelStep) =>
      buildSrcset(String(d.id), {
        sourceWidth: d.width ?? undefined,
        aspectRatio: naturalAspectRatio(d),
        version: deriveVersion(d),
        baseUrl,
        pixelStep,
      }).srcset,
  ),
  virtualUrl('placeholderURL', 'Tiny low-quality placeholder (LQIP) for a blur-up / CSS background.', (d, baseUrl) =>
    buildVariantUrl(String(d.id), 32, { quality: 40, aspectRatio: naturalAspectRatio(d), version: deriveVersion(d), baseUrl }),
  ),
  virtualUrl('thumbnailURL', 'Small focal-cropped square (160px) for cards, lists, and feeds.', (d, baseUrl) =>
    buildVariantUrl(String(d.id), 160, { fit: 'cover', aspectRatio: 1, version: deriveVersion(d), baseUrl }),
  ),
]

/** Field names produced by {@link virtualUrlFields} — used to wire `defaultPopulate`. */
export const VIRTUAL_URL_FIELDS = ['src', 'srcset', 'placeholderURL', 'thumbnailURL'] as const
