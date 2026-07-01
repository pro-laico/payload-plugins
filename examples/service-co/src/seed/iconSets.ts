import { defineSeed } from '@pro-laico/payload-seed'

// The active icon set: the `name → icon` map that `<Icon name="…" />` resolves through. The engine
// creates every icon doc first, then resolves each `ref('icon', …)` to its id. `active: true` +
// `_status: 'published'` so the frontend reads it immediately. Swapping which set is active
// re-skins every `<Icon>` on the site at once — the point of the collection.
export default defineSeed('iconSet', ({ ref }) => [
  {
    _key: 'default',
    title: 'Default',
    active: true,
    _status: 'published',
    iconsArray: [
      { name: 'architecture', icon: ref('icon', 'architecture') },
      { name: 'interiors', icon: ref('icon', 'interiors') },
      { name: 'landscape', icon: ref('icon', 'landscape') },
      { name: 'renovation', icon: ref('icon', 'renovation') },
      { name: 'arrow-right', icon: ref('icon', 'arrow-right') },
      { name: 'check', icon: ref('icon', 'check') },
      { name: 'sparkles', icon: ref('icon', 'sparkles') },
      { name: 'phone', icon: ref('icon', 'phone') },
      { name: 'mail', icon: ref('icon', 'mail') },
      { name: 'map-pin', icon: ref('icon', 'map-pin') },
    ],
  },
])
