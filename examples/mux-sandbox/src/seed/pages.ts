import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('pages', ({ ref }) => [{ _key: 'home', title: 'Home', heroVideo: ref('mux-video', 'sample') }])
