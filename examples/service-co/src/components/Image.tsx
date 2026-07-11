import config from '@payload-config'
import { getPayload } from 'payload'
import { RESPONSIVE_IMAGE_SELECT as select } from '@pro-laico/payload-images'
import { type ImageProps, ResponsiveImage } from '@pro-laico/payload-images/components/image'

/**
 * The project's image component — pass an id + the declared render ({@link ImageProps}, exported
 * by payload-images); one `findByID` declares it on the read (`context: { image, blur }`) and the
 * doc comes back render-ready: `src`/`srcset` built for exactly that render, `croppedBlurHash` a
 * finished focal-cropped placeholder. `<ResponsiveImage>` just paints it.
 */
export async function Image({ id, image, blur, ...rest }: ImageProps) {
  const payload = await getPayload({ config })
  const doc = await payload.findByID({ id, collection: 'images', depth: 0, select, context: { image, blur } })
  return <ResponsiveImage {...doc} {...rest} />
}
