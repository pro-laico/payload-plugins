import { muxVideoPlugin } from '@pro-laico/payload-mux'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import pages from '../seed/pages'
import videos from '../seed/videos'

// The project's plugin barrel — payload.config imports this array.
//
// muxVideoPlugin: no credentials passed — the plugin reads the standard MUX_* env vars
// (MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET), and cors_origin defaults to
// NEXT_PUBLIC_SERVER_URL. Pass options only to override. The mux-video collection declares
// `custom.seedAsset`, so the seed plugin below treats it as an asset collection with no extra wiring.
//
// seedPlugin: because mux-video is a `custom.seedAsset` collection, a video is seeded like an image
// asset — declared with `_file: file('clip.mp4')` and run by the normal seed flow (POST /api/seed or
// the admin button). No custom script. The subdir defaults to the collection slug, so source files
// live in `seed-assets/mux-video/`.
export const plugins: Plugin[] = [
  muxVideoPlugin(),
  seedPlugin({
    adminButton: true,
    definitions: [videos, pages],
    assetsDir: 'seed-assets',
  }),
]
