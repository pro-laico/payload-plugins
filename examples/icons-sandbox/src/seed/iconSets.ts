import { defineSeed } from '@pro-laico/payload-seed'

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
