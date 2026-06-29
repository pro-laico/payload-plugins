import { seedMuxVideos } from '@pro-laico/payload-seed/mux'
import { getPayload } from 'payload'
import config from '../src/payload.config'

/**
 * Local-file Mux seed. Drop your clips in `seed-assets/` (gitignored), set your Mux
 * credentials in `.env.local`, then run:
 *
 *   pnpm --filter mux-sandbox seed:mux
 *
 * It uploads each file to Mux exactly as the admin uploader would, tags the assets so a
 * reseed clears only what it created, and creates the `mux-video` docs. `clear: 'tagged'`
 * makes reseeds idempotent; use `clear: 'all'` to wipe the whole (dev) Mux environment.
 */
const run = async () => {
  const payload = await getPayload({ config })

  const result = await seedMuxVideos(payload, {
    dir: 'seed-assets',
    clear: 'tagged',
    videos: [{ title: 'Sample Clip', file: 'sample.mp4', playbackPolicy: 'public' }],
  })

  payload.logger.info({ msg: '[mux-sandbox] mux seed complete', ...result })
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
