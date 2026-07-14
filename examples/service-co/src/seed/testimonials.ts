import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('testimonials', ({ ref }) => [
  {
    _key: 'cedar-hill',
    quote:
      'They saw a house in a hillside three other architects had turned down. Two years on, it’s still the first thing every visitor comments on.',
    author: 'The Bennett family',
    company: 'Cedar Hill Residence',
    project: ref('projects', 'cedar-hill-residence'),
  },
  {
    _key: 'foundry',
    quote:
      'Meridian understood what to leave alone. The loft feels like it was always meant to be lived in — nothing precious, everything considered.',
    author: 'Dana Whitfield',
    company: 'The Foundry Loft',
    project: ref('projects', 'foundry-loft'),
  },
  {
    _key: 'riverside',
    quote:
      'From the first sketch it was clear they design the landscape and the building as one thing. Our members use the pavilion year-round now.',
    author: 'Riverside Arts Trust',
    company: 'Riverside Pavilion',
    project: ref('projects', 'riverside-pavilion'),
  },
])
