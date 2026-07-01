import { defineSeed } from '@pro-laico/payload-seed'

// The showreel, seeded like any asset: the clip rides on `_file`, and because `mux-video` is a
// registered asset provider the collection's ingest hook uploads it to Mux at create time and fills
// in the playback metadata. Referenced by the home hero (site-settings.showreel) and the featured
// project (projects → video). This definition is only registered when MUX_TOKEN_ID is set (see
// plugins/index.ts), so seeding stays fully offline without credentials.
export default defineSeed('mux-video', ({ file }) => [{ _key: 'showreel', _file: file('showreel.mp4'), title: 'Meridian — Studio Showreel' }])
