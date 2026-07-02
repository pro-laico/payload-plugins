import { defineSeed } from '@pro-laico/payload-seed'

/** The names every set must provide — `<Icon name="…" />` resolves these through whichever set is
 *  active, so each set maps the same names to different icon docs. */
const names = ['architecture', 'interiors', 'landscape', 'renovation', 'arrow-right', 'check', 'sparkles', 'phone', 'mail', 'map-pin'] as const

// Two complete icon sets over the same names: "Default" (active) maps each name to the house
// glyph, "Alternate" maps them to the `-alt` uploads. The engine creates every icon doc first,
// then resolves each `ref('icon', …)` to its id. Activating the other set (admin toggle, or one
// click on /dev/icons) re-skins every `<Icon>` on the site at once — the point of the collection.
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
