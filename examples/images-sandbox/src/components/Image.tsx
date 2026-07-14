import { type ImageProps, ResponsiveImage } from '@pro-laico/payload-images/components/image'

import { imageFor } from '../lib/imageFor'

/**
 * The project's image component — THE consumption pattern for payload-images, all in one place:
 * `imageFor` (src/lib/imageFor.ts, the app's seeded Sanity-style getter) runs one `findByID`
 * that DECLARES the render on the read (`context: { image, blur }`) and selects only what
 * rendering consumes; the doc comes back render-ready — `src`/`srcset` built for exactly this
 * render, `placeholder` a finished focal-cropped one — and spreads straight into the passive
 * `<ResponsiveImage>`. No config, no URL math, nothing client-side. The props type
 * ({@link ImageProps}) ships with the plugin.
 *
 * A real app wraps this same read in its cache layer (keyed by id + render) — see the
 * payload-revalidate example for that version.
 */
export async function Image({ id, image, blur, ...rest }: ImageProps) {
  const doc = await imageFor(id, { image, blur }).fetch()
  return doc ? <ResponsiveImage {...doc} {...rest} /> : null
}
