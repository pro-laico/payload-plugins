import { defineSeed } from '@pro-laico/payload-seed'

// Icons from @pro-laico/payload-icons, seeded like any collection: each SVG rides on `_file`
// (uploaded natively into the `icon` collection, running the optimize/sanitize hook) and is
// referenceable via ref('icon', <_key>). Files live in `assets/icon/`.
export default defineSeed('icon', ({ file }) => [
  { _key: 'arrow-right', _file: file('arrow-right.svg') },
  { _key: 'check', _file: file('check.svg') },
  { _key: 'star', _file: file('star.svg') },
])
