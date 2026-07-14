import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('media', ({ file }) => [
  { _key: 'serviceA', _file: file('service-a.jpg'), alt: 'Consulting service' },
  { _key: 'serviceB', _file: file('service-b.jpg'), alt: 'Implementation service' },
  { _key: 'post', _file: file('post-cover.jpg'), alt: 'Blog post cover' },
  { _key: 'logo', _file: file('logo.jpg'), alt: 'Brand logo' },
])
