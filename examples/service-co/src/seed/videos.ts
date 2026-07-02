import { defineSeed } from '@pro-laico/payload-seed'

// The showreel, seeded like any asset: the clip rides on `_file`, and because `mux-video` is a
// `custom.seedAsset` collection its ingest hook uploads it to Mux at create time and fills in the
// playback metadata. Referenced by the home hero (site-settings.showreel). Without credentials the
// Mux plugin marks the collection seed-disabled, so the engine skips this definition (and drops the
// showreel ref) with a warning — seeding stays fully offline, and setting MUX_TOKEN_ID /
// MUX_TOKEN_SECRET makes the next run ingest and wire it automatically.
export default defineSeed('mux-video', ({ file }) => [{ _key: 'showreel', _file: file('showreel.mp4'), title: 'Meridian — Studio Showreel' }])
