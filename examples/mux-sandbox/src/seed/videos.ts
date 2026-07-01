import { defineSeed } from '@pro-laico/payload-seed'

// A mux-video seeded like any collection: the clip rides on the `_file` meta-key and — since
// `mux-video` is a registered asset provider — is handed to the collection's ingest hook, which
// uploads it to Mux at create time and fills in assetId + playback metadata. Reference it from any
// collection via ref('mux-video', …). Playback policy comes from muxVideoPlugin's uploadSettings.
export default defineSeed('mux-video', ({ file }) => [{ _key: 'sample', _file: file('sample.mp4'), title: 'Sample Clip' }])
