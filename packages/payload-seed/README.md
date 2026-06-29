# @pro-laico/payload-seed

Type-safe database seeding for [Payload CMS](https://payloadcms.com/). Write seed data in
`seed.ts` files, reference other docs and uploads with typed tokens instead of raw ids, and
the plugin orders dependencies, uploads media, and creates everything — behind an
`ENABLE_SEED` kill switch.

```bash
pnpm add @pro-laico/payload-seed
```

## Use

**1. Write seed files.** One default export per collection/global; give each record a
`_key`, and point at other docs / uploads with `ref()` / `asset()`:

```ts
// collections/Services/seed.ts
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ asset }) => [
  { _key: 'consulting', title: 'Consulting', slug: 'consulting', image: asset('serviceA') },
])

// collections/Posts/seed.ts
export default defineSeed('posts', ({ ref, asset }) => [
  { _key: 'launch', title: 'We launched', heroImage: asset('post'), relatedService: ref('services', 'consulting') },
])
```

**2. Declare the uploadable assets** (files live in `assets/`):

```ts
// seed/assets.ts
import { defineAssets } from '@pro-laico/payload-seed'

export default defineAssets({
  serviceA: { file: 'service-a.jpg', alt: 'Consulting' },
  post: { file: 'post-cover.jpg', alt: 'Cover' },
})
```

**3. Add the plugin** with your definitions:

```ts
import { seedPlugin } from '@pro-laico/payload-seed'
import services from './collections/Services/seed'
import posts from './collections/Posts/seed'
import assets from './seed/assets'

plugins: [seedPlugin({ definitions: [assets, services, posts], adminButton: true })]
```

**4. Run it.** Set `ENABLE_SEED=true`, then either click **Seed your database** in the admin
header or run `pnpm payload seed`. (The seed is destructive — it clears and recreates the
seeded collections.)

## Typed references

Run `payload generate:types` and the plugin injects a `SeedRegistry` into `payload-types.ts`,
so `ref('services', 'consulting')` is checked against your real `_key`s — rename or remove a
seeded item and every stale reference becomes a TS error. Unknown fields error too. It's
global, no import (like Payload's own generated types).

## Options

| Option | Default | |
| --- | --- | --- |
| `definitions` | — | Your seed definitions (the `seed.ts` default exports). |
| `assets` | `{ dir: 'assets', collection: 'media' }` | Where source files live + the upload collection. |
| `adminButton` | `false` | Show the seed button in the admin header. |

## Mux video seeding (`./mux`)

The `./mux` subpath seeds [`@pro-laico/payload-mux`](../payload-mux) videos from **local
files** — it uploads a clip to your Mux account exactly as the admin uploader would, the easy
way to push content from local into a live Mux account without committing video files to git.
It imports only the third-party `@mux/mux-node` SDK (a regular dependency of this package, so
nothing extra to install) and reads the mux plugin's credentials from `config.custom` by
convention; it never imports `@pro-laico/payload-mux`, so the two stay decoupled.

Per video it creates a Mux direct upload, PUTs the local file's bytes, **waits for Mux to
finish encoding** (up to ~2 min), then creates the `mux-video` doc with the ready asset's
metadata — tagged (Mux `passthrough`) so a reseed clears only what it made. Because it waits
for `ready`, seeded videos are immediately playable with **no webhook needed** (a clip needing
more than ~2 min throws rather than creating an incomplete doc).

```ts
// scripts/seed-mux.ts — run with `payload run scripts/seed-mux.ts`
import { seedMuxVideos } from '@pro-laico/payload-seed/mux'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config })

await seedMuxVideos(payload, {
  // One entry per clip to upload + create:
  videos: [
    {
      title: 'Intro', // doc title — must be unique in the collection
      file: 'intro.mp4', // local file, relative to `dir` → seed-assets/intro.mp4 (nested paths ok)
      playbackPolicy: 'public', // 'public' (default) or 'signed'
      posterTimestamp: 3, // optional poster frame, seconds in (default: middle of the video)
    },
  ],
  dir: 'seed-assets', // base dir each video's `file` resolves against (default: 'seed-assets')
  clear: 'tagged', // reseed cleanup: 'tagged' = only seed-created assets+docs; 'all' = wipe the Mux env
  // collection: 'mux-video',   // override the collection slug
  // corsOrigin: '*',           // CORS origin for the direct upload
  // initSettings: { ... },     // override Mux creds; omitted fields read their MUX_* env var
})
```

The lower-level `uploadMuxVideoFromFile(mux, path, opts)` and `clearMuxSeed(payload, mux, { scope })`
are exported too if you want to orchestrate the flow yourself.

## License

MIT
