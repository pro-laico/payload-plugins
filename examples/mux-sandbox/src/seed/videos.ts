import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('mux-video', ({ file }) => [{ _key: 'sample', _file: file('sample.mp4'), title: 'Sample Clip' }])
