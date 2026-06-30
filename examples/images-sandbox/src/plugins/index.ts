import { imagesPlugin } from '@pro-laico/payload-images'
import { type SeedPluginOptions, seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import assets from '../seed/assets'
import pages from '../seed/pages'

// The seed config — exported so the frontend demo's "Seed" server action can run the same
// seed the admin button / POST /api/seed runs, with no duplication (`seed({ payload,
// options: seedOptions })`).
//
// The `images` collection is a native Payload upload, so it seeds with the normal `asset()`
// flow — no asset provider (that seam is only for external bytes like Mux). We just point
// asset uploads at `images` instead of the default `media`. Files live in `seed-assets/image/`.
export const seedOptions: SeedPluginOptions = {
  adminButton: true,
  definitions: [assets, pages],
  assets: { dir: 'seed-assets', collection: 'images' },
}

// The project's plugin barrel — payload.config imports this array.
//
// imagesPlugin: registers the `images` (source) + hidden `generated-images` (variant cache)
// collections and the on-demand transform endpoint at /api/img/:id (+ purge). Uploads store
// only the original; every size is generated on first request and cached.
export const plugins: Plugin[] = [imagesPlugin(), seedPlugin(seedOptions)]
