import { defineSeed } from '@pro-laico/payload-seed'

// A mux-video seeded like an image asset: the `video()` source token points at a file in
// `seed-assets/videos/`; the mux plugin's collection hook uploads it to Mux at create time and
// fills in assetId + playback metadata. Reference it from any collection via ref('mux-video', …).
export default defineSeed('mux-video', ({ video }) => [
  { _key: 'sample', title: 'Sample Clip', source: video('7005445-hd_1920_1080_30fps.mp4', { playbackPolicy: 'public' }) },
])
