import { defineSeed } from '@pro-laico/payload-seed'

// The icon library — one native upload per SVG in `seed-assets/icon/`. On create the payload-icons
// hook optimizes + sanitizes each file and rewrites its fills to `currentColor`, so the same source
// recolors from CSS. (The plugin themes fill-based glyphs, so these are solid single-colour icons,
// not strokes.) `_key` is the name the active set (iconSets.ts) maps to, and what
// `<Icon name="…" />` and each Service's `icon` relationship resolve.
//
// Two glyphs exist per name: the house style, and an `-alt` variant (public-domain solid icons via
// the Noun Project) that the second, inactive icon set maps to — activate "Alternate" in the admin
// (or /dev/icons) and every <Icon> on the site re-skins at once.
export default defineSeed('icon', ({ file }) => [
  // The default set's glyphs. The four service glyphs come first; the rest are UI accents.
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
  // The alternate set's glyphs — same concepts, visibly different drawings.
  { _key: 'architecture-alt', _file: file('architecture-alt.svg') },
  { _key: 'interiors-alt', _file: file('interiors-alt.svg') },
  { _key: 'landscape-alt', _file: file('landscape-alt.svg') },
  { _key: 'renovation-alt', _file: file('renovation-alt.svg') },
  { _key: 'arrow-right-alt', _file: file('arrow-right-alt.svg') },
  { _key: 'check-alt', _file: file('check-alt.svg') },
  { _key: 'sparkles-alt', _file: file('sparkles-alt.svg') },
  { _key: 'phone-alt', _file: file('phone-alt.svg') },
  { _key: 'mail-alt', _file: file('mail-alt.svg') },
  { _key: 'map-pin-alt', _file: file('map-pin-alt.svg') },
])
