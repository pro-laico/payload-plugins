import { defineSeed } from '@pro-laico/payload-seed'

/** The sample images, seeded like any collection: each doc carries its source file on `_file`
 *  (uploaded natively into the `images` collection) and is referenceable via ref('images', <_key>).
 *  Files live in `seed-assets/images/`.
 *
 *  `focalX`/`focalY` (percentages from the top-left) mark each photo's off-center subject, so the
 *  on-demand focal-aware crops keep it in frame across aspect ratios. */
export default defineSeed('images', ({ file }) => [
  {
    _key: 'lighthouse',
    _file: file('lighthouse.png'),
    alt: 'Landscape sample',
    focalX: 78,
    focalY: 32,
    // The `og` template is toggled on; a custom `card` preset is constructed inline. Both are
    // guaranteed (cap-exempt) and eagerly generated on upload.
    presets: [{ template: 'og' }, { name: 'card', width: 600, aspectRatio: '4:3', fit: 'cover', quality: 70 }],
  },
  { _key: 'balloon', _file: file('balloon.png'), alt: 'Portrait sample', focalX: 50, focalY: 22, variantLimit: 12 },
  { _key: 'apple', _file: file('apple.png'), alt: 'Square sample', focalX: 28, focalY: 72 },
])
