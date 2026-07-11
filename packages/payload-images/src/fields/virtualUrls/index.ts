/**
 * Virtual (computed, never stored) URL fields, built by `afterRead` hooks from the doc's own
 * fields — so optimized URLs ride along in EVERY read (REST, GraphQL, Local API) and through
 * relationship population. A read that declares its render (`context.image`) gets `src`/`srcset`
 * built for exactly that render; an undeclared read gets natural-ratio defaults. URLs are
 * absolute when `config.serverURL` is set, relative otherwise.
 */
import type { Field } from 'payload'

import { deriveVersion } from '../../lib/urls/version'
import { buildSrcset } from '../../lib/urls/srcset'
import { getImageUrl } from '../../lib/urls/getImageUrl'
import { buildVariantUrl } from '../../lib/urls/variantUrl'
import { aspectRatioAfterRead } from '../../hooks/field/aspectRatio'

import { naturalAspectRatio } from './doc'
import { virtualUrl } from './virtualUrl'

/** Fields the virtual URLs are computed from — kept selected via the collection's `forceSelect`. */
export const VIRTUAL_URL_INPUTS = [
  'width',
  'height',
  'filename',
  'focalX',
  'focalY',
  'focalSize',
  'cropLeft',
  'cropTop',
  'cropRight',
  'cropBottom',
] as const

export const virtualUrlFields = (): Field[] => [
  {
    name: 'aspectRatio',
    type: 'number',
    virtual: true,
    admin: {
      hidden: true,
      description: 'The render aspect ratio: the ratio the read declared (context.image.aspectRatio), else the natural one.',
    },
    hooks: { afterRead: [aspectRatioAfterRead] },
  },
  virtualUrl(
    'variantVersion',
    'Cache-busting version token for transform URLs (changes on file replace / focal / hotspot edits).',
    (d) => deriveVersion(d) ?? null,
  ),
  virtualUrl('src', 'Optimized URL (≤1280px) for a plain <img> or OG tag, honoring the declared render.', (d, { baseUrl, intent }) =>
    getImageUrl(
      { ...d, id: d.id as string | number }, //EXCUSE: the hook above already returned null when id is nullish
      {
        width: Math.min(d.width ?? 1280, 1280),
        aspectRatio: intent.aspectRatio,
        quality: intent.quality,
        fit: intent.fit,
        format: intent.format,
        baseUrl,
      },
    ),
  ),
  virtualUrl(
    'srcset',
    'Responsive srcset up to the source width, honoring the declared render (else the natural ratio).',
    (d, { baseUrl, pixelStep, intent }) =>
      buildSrcset(String(d.id), {
        sourceWidth: d.width ?? undefined,
        aspectRatio: intent.aspectRatio ?? naturalAspectRatio(d),
        quality: intent.quality,
        fit: intent.fit,
        format: intent.format,
        version: deriveVersion(d),
        baseUrl,
        pixelStep,
      }).srcset,
  ),
  virtualUrl('placeholderURL', 'Tiny low-quality placeholder (LQIP) for a blur-up / CSS background.', (d, { baseUrl, intent }) =>
    buildVariantUrl(String(d.id), 32, {
      quality: 40,
      aspectRatio: intent.aspectRatio ?? naturalAspectRatio(d),
      version: deriveVersion(d),
      baseUrl,
    }),
  ),
  virtualUrl('thumbnailURL', 'Small focal-cropped square (160px) for cards, lists, and feeds.', (d, { baseUrl }) =>
    buildVariantUrl(String(d.id), 160, { fit: 'cover', aspectRatio: 1, version: deriveVersion(d), baseUrl }),
  ),
]

/** Field names produced by {@link virtualUrlFields}. */
export const VIRTUAL_URL_FIELDS = ['src', 'srcset', 'aspectRatio', 'placeholderURL', 'thumbnailURL', 'variantVersion'] as const
