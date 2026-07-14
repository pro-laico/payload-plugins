import { defineSeed } from '@pro-laico/payload-seed'

/** The names every set must provide — `<Icon name="…" />` resolves these through whichever set is
 *  active, so each set maps the same names to different icon docs. */
const names = ['architecture', 'interiors', 'landscape', 'renovation', 'arrow-right', 'check', 'sparkles', 'phone', 'mail', 'map-pin'] as const

export default defineSeed('iconSet', ({ ref }) => [
  {
    _key: 'default',
    title: 'Default',
    active: true,
    _status: 'published',
    iconsArray: names.map((name) => ({ name, icon: ref('icon', name) })),
  },
  {
    _key: 'alternate',
    title: 'Alternate',
    active: false,
    _status: 'published',
    iconsArray: names.map((name) => ({ name, icon: ref('icon', `${name}-alt`) })),
  },
])
