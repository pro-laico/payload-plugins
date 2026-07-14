import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('images', ({ file }) => [
  { _key: 'lighthouse', _file: file('lighthouse.png'), alt: 'Lighthouse on the coast', focalX: 78, focalY: 32 },
])
