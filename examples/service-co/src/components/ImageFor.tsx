import { type ImageProps, ResponsiveImage } from '@pro-laico/payload-images/components/image'
import { imageFor } from '@/lib/imageFor'

/**
 * The same component as {@link Image} built the NEW way — `imageFor` (src/lib/imageFor.ts, the
 * app's seeded Sanity-style getter) replaces the hand-written `findByID`: the whole declared
 * render seeds the chain in one go and `fetch()` resolves the render-ready doc
 * (`src`/`srcset`/`alt`/`placeholder`), spread straight into `<ResponsiveImage>`. Identical
 * output, one line of data code. Compare them live at /dev/compare.
 */
export async function ImageFor({ id, image, blur, ...rest }: ImageProps) {
  const doc = await imageFor(id, { image, blur }).fetch()
  return doc ? <ResponsiveImage {...doc} {...rest} /> : null
}
