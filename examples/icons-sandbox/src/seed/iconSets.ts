import { defineSeed } from '@pro-laico/payload-seed'

// An active icon set that maps frontend names to the seeded icons. `<Icon name="arrow-right" />`
// resolves through whichever set is `active`, so this is what makes the drop-in component render.
// The engine creates the icon docs first, then resolves each `ref('icon', …)` to the created icon's
// id. `_status: 'published'` so the non-draft frontend can read it immediately.
export default defineSeed('iconSet', ({ ref }) => [
  {
    _key: 'default',
    title: 'Default',
    active: true,
    _status: 'published',
    iconsArray: [
      { name: 'arrow-right', icon: ref('icon', 'arrow-right') },
      { name: 'check', icon: ref('icon', 'check') },
      { name: 'star', icon: ref('icon', 'star') },
    ],
  },
])
