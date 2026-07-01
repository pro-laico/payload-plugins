import { defineSeed } from '@pro-laico/payload-seed'

// Every photo on the site, seeded as native uploads into the payload-images `images` collection.
// Only the original is stored; each rendered size is generated + cropped on first request. `focalX`
// / `focalY` (percent from top-left) mark each subject so the focal-aware crops keep it in frame
// across aspect ratios. Reference any of these from a doc's upload field via ref('images', <_key>).
// Files live in `seed-assets/images/`.
export default defineSeed('images', ({ file }) => [
  { _key: 'hero', _file: file('hero.jpg'), alt: 'A modern timber-and-concrete home at dusk', focalX: 50, focalY: 55 },
  { _key: 'svc-architecture', _file: file('svc-architecture.png'), alt: 'Board-formed concrete and timber facade', focalX: 50, focalY: 50 },
  { _key: 'svc-interiors', _file: file('svc-interiors.png'), alt: 'A warm minimalist living room', focalX: 50, focalY: 50 },
  { _key: 'svc-landscape', _file: file('svc-landscape.png'), alt: 'A landscaped garden with a stone path', focalX: 50, focalY: 60 },
  { _key: 'svc-renovation', _file: file('svc-renovation.png'), alt: 'A renovated kitchen with restored brick', focalX: 50, focalY: 50 },
  { _key: 'cedar-hill', _file: file('cedar-hill.jpg'), alt: 'Cedar Hill Residence at dusk', focalX: 50, focalY: 50 },
  {
    _key: 'cedar-hill-interior',
    _file: file('cedar-hill-interior.png'),
    alt: 'The double-height living space at Cedar Hill',
    focalX: 50,
    focalY: 45,
  },
  { _key: 'foundry-loft', _file: file('foundry-loft.jpg'), alt: 'The Foundry Loft interior', focalX: 50, focalY: 50 },
  { _key: 'foundry-detail', _file: file('foundry-detail.png'), alt: 'Blackened steel kitchen detail at The Foundry', focalX: 50, focalY: 50 },
  { _key: 'riverside-pavilion', _file: file('riverside-pavilion.jpg'), alt: 'Riverside Pavilion by the water', focalX: 50, focalY: 55 },
  { _key: 'riverside-interior', _file: file('riverside-interior.png'), alt: 'Inside the Riverside Pavilion', focalX: 50, focalY: 50 },
  { _key: 'team-1', _file: file('team-1.png'), alt: 'Portrait of the principal architect', focalX: 50, focalY: 38 },
  { _key: 'team-2', _file: file('team-2.png'), alt: 'Portrait of the design director', focalX: 50, focalY: 38 },
  { _key: 'team-3', _file: file('team-3.png'), alt: 'Portrait of the landscape lead', focalX: 50, focalY: 38 },
])
