import { defineSeed } from '@pro-laico/payload-seed'

// An active icon set that maps frontend names to the seeded icons. `<Icon name="arrow-right" />`
// resolves through whichever set is `active`, so this is what makes the drop-in component render.
// The engine uploads the icon assets first, then resolves each `asset(...)` to the created icon's
// id. `_status: 'published'` so the non-draft frontend can read it immediately.
export default defineSeed('iconSet', ({ asset }) => [
  {
    _key: 'default',
    title: 'Default',
    active: true,
    _status: 'published',
    iconsArray: [
      { name: 'arrow-right', icon: asset('arrow-right') },
      { name: 'check', icon: asset('check') },
      { name: 'star', icon: asset('star') },
    ],
  },
])
