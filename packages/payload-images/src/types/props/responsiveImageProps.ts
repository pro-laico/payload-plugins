/** Props for `<ResponsiveImage>` and the app-level `<Image>` wrapper it's built around. */
import type { CSSProperties } from 'react'

import type { Fit } from '../transform/format'
import type { AspectRatio, BlurRenderIntent, ImageRenderIntent } from '../plugin/renderIntent'

export interface ResponsiveImageProps {
  id: string | number
  alt: string
  /** The `sizes` attribute. Default `100vw`. */
  sizes?: string
  /** CSS aspect-ratio for the box (`16/9` | `"16/9"` | `"16:9"`) — match what the read declared.
   *  Ignored when `fill` is set. */
  aspectRatio?: AspectRatio
  /** Cover-fill a height-driven, positioned parent instead of acting as an aspect-ratio box
   *  (`position:absolute; inset:0; size:100%`, no aspect-ratio). Default false. */
  fill?: boolean
  /** CSS `object-fit`. Default `cover`. Pass the same value the read declared so the CSS matches the crop. */
  fit?: Fit
  /** Native `<img>` `loading`. Default `lazy`; set `eager` for an above-the-fold hero. */
  loading?: 'lazy' | 'eager'
  /** Native `<img>` `fetchpriority`. Default `auto`; set `high` for the LCP image. */
  fetchPriority?: 'high' | 'low' | 'auto'
  /** Native `<img>` `decoding` hint. Default `async`. */
  decoding?: 'async' | 'auto' | 'sync'
  className?: string
  style?: CSSProperties
  /** The doc's `croppedBlurHash` — painted as the `<img>`'s background while it loads. */
  placeholder?: string | null
  /** Extra `data-*` attributes spread onto the `<img>`. */
  dataAttributes?: Record<`data-${string}`, string>
  src?: string | null | undefined
  srcset?: string | null | undefined
}

/**
 * Props for the ONE image component an app writes around its getter:
 *
 *   export async function Image({ id, image, blur, ...rest }: ImageProps) {
 *     const payload = await getPayload({ config })
 *     const doc = await payload.findByID({ id, collection: 'images', depth: 0, select: RESPONSIVE_IMAGE_SELECT, context: { image, blur } })
 *     return <ResponsiveImage {...doc} {...rest} />
 *   }
 *
 * `image`/`blur` go into the read's `context` verbatim; everything else is presentation.
 */
export interface ImageProps extends Omit<ResponsiveImageProps, 'id' | 'alt' | 'src' | 'srcset' | 'placeholder'> {
  /** The image doc id — the component fetches the rest itself. */
  id: string | number
  /** The declared render — becomes `context.image` (srcset geometry/quality/fit/format). */
  image?: ImageRenderIntent
  /** The declared placeholder — becomes `context.blur` (tier + answer form). */
  blur?: BlurRenderIntent
}
