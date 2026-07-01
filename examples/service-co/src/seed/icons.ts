import { defineSeed } from '@pro-laico/payload-seed'

// The icon library — one native upload per SVG in `seed-assets/icon/`. On create the payload-icons
// hook optimizes + sanitizes each file and rewrites its fills to `currentColor`, so the same source
// recolors from CSS. (The plugin themes fill-based glyphs, so these are solid single-colour icons,
// not strokes.) `_key` is the name the active set (iconSets.ts) maps to, and what
// `<Icon name="…" />` and each Service's `icon` relationship resolve. The four service glyphs come
// first; the rest are UI accents (buttons, feature ticks, contact details).
export default defineSeed('icon', ({ file }) => [
  { _key: 'architecture', _file: file('architecture.svg') },
  { _key: 'interiors', _file: file('interiors.svg') },
  { _key: 'landscape', _file: file('landscape.svg') },
  { _key: 'renovation', _file: file('renovation.svg') },
  { _key: 'arrow-right', _file: file('arrow-right.svg') },
  { _key: 'check', _file: file('check.svg') },
  { _key: 'sparkles', _file: file('sparkles.svg') },
  { _key: 'phone', _file: file('phone.svg') },
  { _key: 'mail', _file: file('mail.svg') },
  { _key: 'map-pin', _file: file('map-pin.svg') },
])
