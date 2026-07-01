# @pro-laico/payload-seed

Type-safe database seeding for [Payload CMS](https://payloadcms.com/). Write seed data in
`seed.ts` files, reference other docs with typed tokens instead of raw ids, attach upload
files inline, and the plugin orders dependencies, uploads media, and creates everything —
behind an `ENABLE_SEED` kill switch.

```bash
pnpm add @pro-laico/payload-seed
```

## Use

**1. Write seed files.** One `defineSeed` default export per collection or global (it infers
which from the slug); give each collection record a `_key`. An upload doc carries its source file
on `_file` via `file()`; point at other docs with `ref()`:

```ts
// collections/Media/seed.ts — each upload doc carries its file on `_file`
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('media', ({ file }) => [
  { _key: 'serviceImg', _file: file('service-a.jpg'), alt: 'Consulting' },
  { _key: 'postCover', _file: file('post-cover.jpg'), alt: 'Cover' },
])

// collections/Posts/seed.ts — point at other seeded docs with ref()
export default defineSeed('posts', ({ ref }) => [
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
| `assetsDir` | `'assets'` | Root folder (relative to the project) where `_file` source files live. |
| `assetSubDirs` | `{}` | Per-collection source subfolder under `assetsDir` (defaults to the collection slug). |
| `adminButton` | `false` | Show the seed button in the admin header. |

## External-asset collections

Most collections take a plain Payload upload for their `_file` and seed natively. A few don't: the
bytes are ingested by the collection's **own hook** into an external service — e.g.
[`@pro-laico/payload-mux`](../payload-mux)'s `mux-video`, whose bytes live in Mux. To seed one, mark
the collection's own Payload config so the engine hands the `_file` to that hook instead of uploading
bytes:

```ts
// in the collection's own config — usually set by its plugin, not by you
{
  slug: 'mux-video',
  custom: { seedAsset: { sourceField: 'source' } }, // or: seedAsset: true for the defaults
  fields: [{ name: 'source', type: 'json' /* the field the ingest hook reads */ }, /* ... */],
}
```

- **`sourceField`** — the field the engine sets to `{ file, ...options }` for the ingest hook. Default `'source'`.
- **`subdir`** — source-file folder under `assetsDir`. Default the collection slug; override with `assetSubDirs`.
- **`seedAsset: true`** — shorthand for both defaults.

The engine **auto-discovers** the marker from the live config — no plugin option to register, and the
owning plugin never imports the seed package. A marked collection then seeds **like any other doc**:
give the record a `_file`, reference it with `ref()`. On run the engine resolves the file under
`assetsDir/<subdir>`, writes it to `sourceField`, and the collection's own hook stores it; reseeds
clear via `payload.delete` so any `afterDelete` cleanup fires. `muxVideoPlugin()` sets this marker on
`mux-video` for you — see [payload-mux](../payload-mux) for the worked example. Collections
whose asset is a plain upload (payload-fonts' `fontOriginal`, payload-images' `image`) need **no**
marker — they seed natively and other docs just `ref()` them.

Running the seed (admin button / `POST /api/seed` / `payload seed`) uploads each `mux-video`
doc's `_file` to Mux, **waits for the asset to be ready**, creates the doc with the asset
metadata, then resolves every `ref('mux-video', …)`. Reseeds clear the marked collection via
`payload.delete`, so the mux plugin's `afterDelete` hook removes the old Mux assets too. For
one-off programmatic creation outside seeding, the mux plugin also exports `ingestMuxVideo()`.

## License

MIT
