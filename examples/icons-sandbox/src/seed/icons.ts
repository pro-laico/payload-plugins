import { defineSeed } from '@pro-laico/payload-seed'

// Icons seed like any collection: each SVG rides on the record's `_file` meta-key — uploaded
// natively into the `icon` collection (running the optimize/sanitize hook) — and is referenceable
// elsewhere via ref('icon', <_key>). Files live in `seed-assets/icon/`.
export default defineSeed('icon', ({ file }) => [
  { _key: 'arrow-right', _file: file('arrow-right.svg') },
  { _key: 'check', _file: file('check.svg') },
  { _key: 'star', _file: file('star.svg') },
])
