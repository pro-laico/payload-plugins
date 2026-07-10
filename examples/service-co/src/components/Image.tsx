import type { PlaceholderQuality } from '@pro-laico/payload-images'
import { ResponsiveImage, type ResponsiveImageProps } from '@pro-laico/payload-images/components/image'
import { getImage } from '@/lib/data'

/**
 * The project's image component — hand it an id, it self-fetches through the cached id-keyed
 * getter and passes everything through to the passive `<ResponsiveImage>`. The getter is told
 * what's being rendered (`{ ar, quality }`), so `croppedBlurHash` arrives as a finished,
 * focal-cropped placeholder data URI for this exact box, and the cache holds one entry per
 * (image, ratio), all busted together by `images:{id}` on any edit.
 */
export interface ImageProps extends Omit<ResponsiveImageProps, 'image' | 'config'> {
  /** The image doc id — the component fetches the rest itself. */
  id: string | number
  /** Placeholder quality tier (`xs`…`xl` blurhash, `xxl`/`x3` micro-webp). Default `sm`. */
  blurhashQuality?: PlaceholderQuality
}

export async function Image({ id, blurhashQuality, aspectRatio, ...rest }: ImageProps) {
  const doc = await getImage(id, { ar: aspectRatio, quality: blurhashQuality })
  if (!doc) return null
  return <ResponsiveImage image={doc} aspectRatio={aspectRatio} {...rest} />
}
