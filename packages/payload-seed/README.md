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
It imports only the third-party `@mux/mux-node` SDK (an **optional peer dependency** — install
it to use this) and reads the mux plugin's credentials from `config.custom` by convention; it
never imports `@pro-laico/payload-mux`, so the two stay decoupled.

```ts
// scripts/seed-mux.ts — run with `payload run scripts/seed-mux.ts`
import { seedMuxVideos } from '@pro-laico/payload-seed/mux'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config })
await seedMuxVideos(payload, {
  dir: 'seed-assets',          // local clips, relative dir (keep them out of git)
  clear: 'tagged',             // idempotent reseed; 'all' wipes the whole (dev) Mux environment
  videos: [{ title: 'Intro', file: 'intro.mp4', playbackPolicy: 'public' }],
})
```

`seedMuxVideos(payload, options)` options:

| Option | Default | |
| --- | --- | --- |
| `videos` | — | `{ title, file, playbackPolicy?, posterTimestamp? }[]` to upload + create. |
| `dir` | `'seed-assets'` | Directory the `file` paths are relative to. |
| `clear` | — | `true`/`'tagged'` clears only seed-created (tagged) assets + docs; `'all'` wipes every asset in the Mux environment. |
| `collection` | `'mux-video'` | Override the collection slug. |
| `initSettings` | `MUX_*` env vars | Override Mux credentials; omitted fields read their `MUX_*` env var. |
| `corsOrigin` | `'*'` | CORS origin for the direct upload. |

Each uploaded asset is stamped with a Mux `passthrough` tag, so `clear: 'tagged'` removes only
what the seed created — never assets you uploaded by hand or in the dashboard. The lower-level
`uploadMuxVideoFromFile(mux, path, opts)` and `clearMuxSeed(payload, mux, { scope })` are
exported too if you want to orchestrate the flow yourself.

## License

MIT
