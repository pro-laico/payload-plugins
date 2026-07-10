import config from '@payload-config'
import { getPayload } from 'payload'
import { type ImageProps, RESPONSIVE_IMAGE_SELECT, ResponsiveImage } from '@pro-laico/payload-images/components/image'

/**
 * The project's image component — THE consumption pattern for payload-images, all in one place:
 * one `payload.findByID` that DECLARES the render on the read (`context: { image, blur }`) and
 * selects only what rendering consumes ({@link RESPONSIVE_IMAGE_SELECT}); the doc comes back
 * render-ready — `src`/`srcset` built for exactly this render, `croppedBlurHash` a finished
 * focal-cropped placeholder — and the passive `<ResponsiveImage>` just paints it. No config, no
 * URL math, nothing client-side. The props type ({@link ImageProps}) ships with the plugin.
 *
 * A real app wraps this same read in its cache layer (keyed by id + render) — see the
 * payload-revalidate example for that version.
 */
export async function Image({ id, image, blur, ...rest }: ImageProps) {
  const payload = await getPayload({ config })
  const doc = await payload.findByID({ id, collection: 'images', depth: 0, select: RESPONSIVE_IMAGE_SELECT, context: { image, blur } })
  return <ResponsiveImage id={doc.id} alt={doc.alt} src={doc.src} srcset={doc.srcset} placeholder={doc.croppedBlurHash} {...rest} />
}
