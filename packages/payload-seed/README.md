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
| `assetProviders` | `[]` | External-asset providers (e.g. `muxAssetProvider()`) — see below. |
| `adminButton` | `false` | Show the seed button in the admin header. |

## External assets (Mux video)

Some collections store their "file" in an external service rather than a Payload upload — e.g.
[`@pro-laico/payload-mux`](../payload-mux)'s `mux-video`, whose bytes live in Mux. An **asset
provider** lets such a collection seed **like an image asset**: declare it with a source token
and reference it anywhere, all within the normal seed run — no custom script.

Register the provider (the mux plugin exports it) and seed a video with the `video()` source
token. The provider is plain config; the actual upload to Mux happens in the mux plugin's own
collection hook, so the two packages stay decoupled:

```ts
import { muxAssetProvider, muxVideoPlugin } from '@pro-laico/payload-mux'
import { seedPlugin } from '@pro-laico/payload-seed'
import videos from './seed/videos'
import pages from './seed/pages'

plugins: [
  muxVideoPlugin(),
  seedPlugin({
    definitions: [videos, pages],
    assets: { dir: 'seed-assets' },          // video files live under seed-assets/videos/
    assetProviders: [muxAssetProvider()],    // token 'video', collection 'mux-video', dir 'video'
  }),
]
```

```ts
// seed/videos.ts — the source file is uploaded to Mux, then the doc is created with its metadata
export default defineSeed('mux-video', ({ video }) => [
  { _key: 'intro', title: 'Intro', source: video('intro.mp4', { playbackPolicy: 'public', posterTimestamp: 3 }) },
])

// seed/pages.ts — reference it like any other doc; the engine seeds the video first
export default defineSeed('pages', ({ ref }) => [
  { _key: 'home', title: 'Home', heroVideo: ref('mux-video', 'intro') },
])
```

Running the seed (admin button / `POST /api/seed` / `payload seed`) uploads each `video()`
source to Mux, **waits for the asset to be ready**, creates the `mux-video` doc with the asset
metadata, then resolves every `ref('mux-video', …)`. Reseeds clear the provider collection via
`payload.delete`, so the mux plugin's `afterDelete` hook removes the old Mux assets too. For
one-off programmatic creation outside seeding, the mux plugin also exports `ingestMuxVideo()`.

## License

MIT
