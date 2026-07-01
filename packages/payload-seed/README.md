# @pro-laico/payload-seed

Type-safe database seeding for [Payload CMS](https://payloadcms.com/). Write seed data in
`seed.ts` files, reference other docs with typed tokens instead of raw ids, attach upload
files inline, and the plugin orders dependencies, uploads media, and creates everything —
behind an `ENABLE_SEED` kill switch.

```bash
pnpm add @pro-laico/payload-seed
```

## Use

**1. Write seed files.** One default export per collection/global; give each record a
`_key`. An upload doc carries its source file on `_file` via `file()`; point at other docs
with `ref()`:

```ts
// collections/Media/seed.ts — each upload doc carries its file on `_file`
import { defineCollectionSeed } from '@pro-laico/payload-seed'

export default defineCollectionSeed('media', ({ file }) => [
  { _key: 'serviceImg', _file: file('service-a.jpg'), alt: 'Consulting' },
  { _key: 'postCover', _file: file('post-cover.jpg'), alt: 'Cover' },
])

// collections/Posts/seed.ts — point at other seeded docs with ref()
export default defineCollectionSeed('posts', ({ ref }) => [
  { _key: 'launch', title: 'We launched', heroImage: ref('media', 'postCover'), relatedService: ref('services', 'consulting') },
])
```

**2. Add the plugin** with your definitions:

```ts
import { seedPlugin } from '@pro-laico/payload-seed'
import media from './collections/Media/seed'
import services from './collections/Services/seed'
import posts from './collections/Posts/seed'

plugins: [seedPlugin({ definitions: [media, services, posts], adminButton: true })]
```

**3. Run it.** Set `ENABLE_SEED=true`, then either click **Seed your database** in the admin
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
| `assets` | `{ dir: 'assets' }` | Where `_file` source files live. |
| `assetProviders` | `[]` | External-asset providers (e.g. `muxAssetProvider()`) — see below. |
| `adminButton` | `false` | Show the seed button in the admin header. |

## External assets (Mux video)

Some collections store their "file" in an external service rather than a Payload upload — e.g.
[`@pro-laico/payload-mux`](../payload-mux)'s `mux-video`, whose bytes live in Mux. A `_file` on
such a doc can't be a native upload, so you **register the collection as an asset provider** and
the engine hands the file to the collection's own ingest hook instead. The doc still seeds **like
any other** — give it a `_file`, reference it with `ref()`, all within the normal seed run.

Register the provider (the mux plugin exports it) and seed a `mux-video` doc with a `_file`. A
`SeedAssetProvider` is plain config — `{ collection, subdir?, sourceField? }` — decoupled both
ways: the mux plugin returns it without importing the seed package, and the engine consumes it
without importing the mux plugin or its SDK. The actual upload to Mux happens in the mux plugin's
own collection hook:

```ts
import { muxAssetProvider, muxVideoPlugin } from '@pro-laico/payload-mux'
import { seedPlugin } from '@pro-laico/payload-seed'
import videos from './seed/videos'
import pages from './seed/pages'

plugins: [
  muxVideoPlugin(),
  seedPlugin({
    definitions: [videos, pages],
    assetsDir: 'seed-assets',                // video files live under seed-assets/video/
    assetProviders: [muxAssetProvider()],    // collection 'mux-video', subdir 'video'
  }),
]
```

```ts
// seed/videos.ts — a mux-video doc; its file rides on `_file`, uploaded to Mux, then the doc
// is created with its metadata. Playback policy comes from muxVideoPlugin's uploadSettings.
export default defineCollectionSeed('mux-video', ({ file }) => [
  { _key: 'intro', _file: file('intro.mp4'), title: 'Intro', posterTimestamp: 3 },
])

// seed/pages.ts — reference it like any other doc; the engine seeds the video first
export default defineCollectionSeed('pages', ({ ref }) => [
  { _key: 'home', title: 'Home', heroVideo: ref('mux-video', 'intro') },
])
```

Running the seed (admin button / `POST /api/seed` / `payload seed`) uploads each `mux-video`
doc's `_file` to Mux, **waits for the asset to be ready**, creates the doc with the asset
metadata, then resolves every `ref('mux-video', …)`. Reseeds clear the provider collection via
`payload.delete`, so the mux plugin's `afterDelete` hook removes the old Mux assets too. For
one-off programmatic creation outside seeding, the mux plugin also exports `ingestMuxVideo()`.

## License

MIT
