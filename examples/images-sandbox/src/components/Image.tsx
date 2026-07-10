import config from '@payload-config'
import { getPayload } from 'payload'
import type { ReactElement } from 'react'
import type { PlaceholderQuality } from '@pro-laico/payload-images'
import { ResponsiveImage, type ResponsiveImageProps } from '@pro-laico/payload-images/components/image'

/**
 * The project's image component — THE consumption pattern for payload-images: hand it an id,
 * it fetches its own doc with the leanest possible read, and passes everything through to the
 * passive `<ResponsiveImage>`.
 *
 *  - `select` only what rendering consumes: alt + dims + the `croppedBlurHash` virtual (a
 *    finished placeholder) + `variantVersion` (the cache-bust token). The focal/crop
 *    processing lives in the plugin's field hook, not here.
 *  - `context.blurhash` tells the read what's being rendered, so the placeholder arrives
 *    already focal-cropped to this exact aspect ratio at the requested quality tier — the
 *    component itself does zero placeholder work.
 */
export interface ImageProps extends Omit<ResponsiveImageProps, 'image'> {
  /** The image doc id — the component fetches the rest itself. */
  id: string | number
  /** Placeholder quality tier (`xs`…`xl` blurhash, `xxl`/`x3` micro-webp). Default `sm`. */
  blurhashQuality?: PlaceholderQuality
}

export async function Image({ id, blurhashQuality, aspectRatio, ...rest }: ImageProps): Promise<ReactElement | null> {
  const payload = await getPayload({ config })
  const doc = await payload.findByID({
    collection: 'images',
    id,
    depth: 0,
    select: { alt: true, width: true, height: true, croppedBlurHash: true, variantVersion: true },
    context: { blurhash: { ar: aspectRatio, quality: blurhashQuality } },
  })

  return <ResponsiveImage image={doc} aspectRatio={aspectRatio} {...rest} />
}
