import { defineSeed } from '@pro-laico/payload-seed'

// A sample image for @pro-laico/payload-images: the doc stores only the original; every
// rendered size is derived on demand. Editing alt/focal busts `images:{id}` — exactly the
// one cacheDoc entry (`getImage`) that renders it, everywhere it's used.
export default defineSeed('images', ({ file }) => [
  { _key: 'lighthouse', _file: file('lighthouse.png'), alt: 'Lighthouse on the coast', focalX: 78, focalY: 32 },
])
