import { defineSeed } from '@pro-laico/payload-seed'

// The team. Each `photo` is a payload-images upload, rendered as a square focal-aware crop on the
// About page. `order` sets the sequence.
export default defineSeed('team', ({ ref }) => [
  {
    _key: 'elena',
    name: 'Elena Marsh',
    role: 'Principal Architect',
    order: 1,
    bio: 'Elena founded Meridian in 2011 after a decade in large-practice work. She leads design across every project and still draws by hand.',
    photo: ref('images', 'team-1'),
  },
  {
    _key: 'theo',
    name: 'Theo Nakamura',
    role: 'Design Director, Interiors',
    order: 2,
    bio: 'Theo shapes the material and lighting palettes that carry each building through to its interiors, from joinery details to the last fixture.',
    photo: ref('images', 'team-2'),
  },
  {
    _key: 'sam',
    name: 'Samuel Ortega',
    role: 'Landscape Lead',
    order: 3,
    bio: 'Sam treats the ground plane as part of the architecture — planting, grading, and water designed alongside the building, not after it.',
    photo: ref('images', 'team-3'),
  },
])
