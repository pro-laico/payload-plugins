import type { ImageProps } from '@pro-laico/payload-images/components/image'
import { Image } from '@/components/Image'
import { ImageFor } from '@/components/ImageFor'

const approaches = [
  {
    label: 'Image — hand-written findByID',
    component: Image,
    code: `const payload = await getPayload({ config })
const doc = await payload.findByID({
  id,
  collection: 'images',
  depth: 0,
  select: RESPONSIVE_IMAGE_SELECT,
  context: { image, blur },
})`,
  },
  {
    label: 'ImageFor — Sanity-style chain',
    component: ImageFor,
    code: `const doc = await imageFor(id, { image, blur }).fetch()

// or chained directly:
await imageFor(id).aspectRatio('4:3').quality(80).blur('md').fetch()`,
  },
]

/**
 * The SAME declared render through both of the project's image components, side by side:
 * `Image` (the hand-written `findByID` read contract) and `ImageFor` (the seeded Sanity-style
 * chain from src/lib/imageFor.ts). Both run one identical read under the hood, so the two
 * columns are pixel-identical — only the data code differs. Rendered at /dev/compare.
 */
export function ImageCompare(props: ImageProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {approaches.map(({ label, component: Component, code }) => (
        <figure key={label}>
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            <Component {...props} className="w-full" />
          </div>
          <figcaption className="mt-3">
            <p className="font-mono text-xs uppercase tracking-wider text-primary">{label}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              {code}
            </pre>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
