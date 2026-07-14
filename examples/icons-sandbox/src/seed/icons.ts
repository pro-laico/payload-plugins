import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('icon', ({ file }) => [
  { _key: 'arrow-right', _file: file('arrow-right.svg') },
  { _key: 'check', _file: file('check.svg') },
  { _key: 'star', _file: file('star.svg') },
])
