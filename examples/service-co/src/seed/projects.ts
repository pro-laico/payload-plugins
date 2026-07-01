import { defineSeed } from '@pro-laico/payload-seed'

// Three portfolio projects — the collection that pulls the most plugins together. Each has a
// payload-images `coverImage` + `gallery` and a many-relationship to the `services` used, all wired
// with `ref()` tokens the engine resolves after creating those docs. (The `video` field is left
// unseeded: Mux needs credentials, and the dev server regenerates the seed-ref types on boot
// without them, so referencing `mux-video` here isn't type-stable — attach a video in the admin
// instead. See videos.ts / plugins/index.ts, which ingest a standalone clip when creds are set.)
export default defineSeed('projects', ({ ref }) => [
  {
    _key: 'cedar-hill-residence',
    title: 'Cedar Hill Residence',
    slug: 'cedar-hill-residence',
    client: 'Private residence',
    location: 'Boulder, CO',
    year: 2024,
    featured: true,
    summary: 'A three-bedroom home stepped into a wooded hillside, opening to the forest through a double-height glass wall.',
    description:
      'Cedar Hill sits on a steep, north-facing lot we had been told was unbuildable. Rather than flatten it, we let the ' +
      'slope set the plan: living spaces cantilever toward the view while bedrooms tuck into the hill behind them. Vertical ' +
      'cedar and board-formed concrete tie the house to its setting, and a double-height living space brings the forest ' +
      'canopy inside. We designed the architecture, interiors, and landscape as one project.',
    coverImage: ref('images', 'cedar-hill'),
    gallery: [{ image: ref('images', 'cedar-hill-interior') }, { image: ref('images', 'svc-architecture') }],
    services: [ref('services', 'architecture'), ref('services', 'interiors'), ref('services', 'landscape')],
  },
  {
    _key: 'foundry-loft',
    title: 'The Foundry Loft',
    slug: 'foundry-loft',
    client: 'Private residence',
    location: 'Denver, CO',
    year: 2023,
    featured: false,
    summary: 'A former iron foundry reworked into a single loft — steel and concrete kept raw, softened with warm furnishings.',
    description:
      'The Foundry had good bones: fifteen-foot ceilings, steel trusses, and a wall of factory glass. Our job was mostly ' +
      'restraint. We restored the steel and poured a new polished-concrete floor, then inserted a warm core of oak joinery ' +
      'and blackened-steel cabinetry for the kitchen and bath. The result keeps the building honest while making it a home.',
    coverImage: ref('images', 'foundry-loft'),
    gallery: [{ image: ref('images', 'foundry-detail') }, { image: ref('images', 'svc-interiors') }],
    services: [ref('services', 'interiors'), ref('services', 'renovation')],
  },
  {
    _key: 'riverside-pavilion',
    title: 'Riverside Pavilion',
    slug: 'riverside-pavilion',
    client: 'Riverside Arts Trust',
    location: 'Lyons, CO',
    year: 2023,
    featured: false,
    summary: 'A small glass-and-timber pavilion set at the water’s edge, framing the river through full-height glazing.',
    description:
      'A community arts trust wanted a year-round space for readings and small gatherings on a riverside meadow. We kept the ' +
      'footprint light — thin steel columns, a timber-slat ceiling, and full-height glass that slides open to the garden in ' +
      'summer. The landscape does the rest, with native grasses and a shallow reflecting channel that mirrors the sky.',
    coverImage: ref('images', 'riverside-pavilion'),
    gallery: [{ image: ref('images', 'riverside-interior') }, { image: ref('images', 'svc-landscape') }],
    services: [ref('services', 'architecture'), ref('services', 'landscape')],
  },
])
