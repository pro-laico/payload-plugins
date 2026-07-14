import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ ref }) => [
  {
    _key: 'architecture',
    title: 'Architecture',
    slug: 'architecture',
    order: 1,
    summary: 'Ground-up design for homes and small commercial spaces — from first sketch through permit and construction drawings.',
    icon: ref('icon', 'architecture'),
    image: ref('images', 'svc-architecture'),
  },
  {
    _key: 'interiors',
    title: 'Interior Design',
    slug: 'interiors',
    order: 2,
    summary: 'Interiors that carry the architecture through: material palettes, joinery, lighting, and the furniture that finishes a room.',
    icon: ref('icon', 'interiors'),
    image: ref('images', 'svc-interiors'),
  },
  {
    _key: 'landscape',
    title: 'Landscape',
    slug: 'landscape',
    order: 3,
    summary: 'Gardens, courtyards, and grounds designed as part of the building — native planting, hardscape, and water.',
    icon: ref('icon', 'landscape'),
    image: ref('images', 'svc-landscape'),
  },
  {
    _key: 'renovation',
    title: 'Renovation',
    slug: 'renovation',
    order: 4,
    summary: 'Thoughtful renovations and additions that respect what a building already is while making it work for how you live now.',
    icon: ref('icon', 'renovation'),
    image: ref('images', 'svc-renovation'),
  },
])
