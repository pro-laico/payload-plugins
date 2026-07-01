import { muxAssetProvider, muxVideoPlugin } from '@pro-laico/payload-mux'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import pages from '../seed/pages'
import videos from '../seed/videos'

// The project's plugin barrel — payload.config imports this array.
//
// muxVideoPlugin: no credentials passed — the plugin reads the standard MUX_* env vars
// (MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET), and cors_origin defaults to
// NEXT_PUBLIC_SERVER_URL. Pass options only to override.
//
// seedPlugin: registers mux-video as an asset provider, so a video is seeded like an image
// asset — declared with `_file: file('clip.mp4')` and run by the normal seed flow (POST /api/seed
// or the admin button). No custom script. Source files live in `seed-assets/videos/`.
export const plugins: Plugin[] = [
  muxVideoPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: [videos, pages],
    assetsDir: 'seed-assets',
    assetProviders: [muxAssetProvider({ subdir: 'videos' })],
  }),
]
