import { defineSeed } from '@pro-laico/payload-seed'

// The active icon set `<Icon name="…" />` resolves through. `_status: 'published'` so the
// non-draft frontend reads it immediately. Any published write here (swap the active set,
// remap a name) busts the shared `payload-icons` tag — the marker the icon collections
// carry — re-materializing every cached scope that inlined an icon.
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
