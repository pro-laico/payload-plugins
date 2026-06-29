# @pro-laico/payload-seed — design

A schema-aware, type-safe seeding plugin for Payload CMS. It replaces the
hand-maintained seed orchestrator pattern (one big `index.ts` that hardcodes the
collection list, clear order, create order, and prop-drills returned docs) with a
declarative, dependency-tracked system that **stays aligned with the schema by
construction** — drift surfaces as a TypeScript error or a precise runtime error, never as
a silent omission.

Origin: generalized from the seed in `payload-service-template`
(`apps/web/src/seed/*`). That seed had excellent media handling but every other part
was hand-maintained and drifted from the schema. This package keeps the media handling
and makes the rest schema-driven.

## Goals

1. **Type-safe seed data.** Each seed record is typed against the consuming app's
   generated Payload types (`RequiredDataFromCollectionSlug<slug>`). Change a
   collection's fields → the seed file shows a TS error until it matches.
2. **Type-safe references.** A doc is referenced by a named token, not a raw id.
   Remove or rename a seeded item and every `ref()` to it becomes a TS error
   everywhere it's used (via the `SeedRegistry` injected into `payload-types.ts` — see
   "Typed refs").
3. **Strong dependency tracking.** Collections and globals can reference collection docs.
   Every reference is an explicit edge. The engine builds a DAG,
   detects cycles, and topologically sorts the seed order — so an AI (or a human)
   editing one file cannot produce a dangling reference or a wrong order.
4. **Reusable run infra.** Ship the endpoint (`POST /api/seed`), the `ENABLE_SEED`
   kill-switch guard, and an optional admin SeedButton — so a consuming app gets the
   whole seed surface from installing one plugin.
5. **Robust media.** Carry over the template's hard-won upload logic: upload-first,
   MIME-by-real-extension, extension-mismatch tolerance, sequential uploads sharing one
   `req`, missing-file guards, focal points.

## Public API

```ts
// src/plugins/index.ts — assemble definitions and hand them to the plugin
import { seedPlugin } from '@pro-laico/payload-seed'
import services from '../collections/Services/seed'
import posts from '../collections/Posts/seed'
import assets from '../seed/assets'

export const plugins = [
  seedPlugin({
    definitions: [assets, services, posts], // feeds the seed run AND the injected types
    adminButton: true,                      // seed button in the admin header
    // assets: { dir, collection }  (default: assets/ + media)
  }),
]
```

```ts
// src/collections/Services/seed.ts
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ asset }) => [
  {
    _key: 'consulting',                 // local ref handle (free string; codegen reads these)
    title: 'Consulting',
    slug: 'consulting',
    image: asset('serviceA'),           // upload ref → resolved to the uploaded image id
    _status: 'published',
  },
])
```

```ts
// src/collections/Posts/seed.ts  (a different file, referencing the service above)
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('posts', ({ ref, asset }) => [
  {
    _key: 'launch',
    title: 'We launched',
    heroImage: asset('post'),
    relatedService: ref('services', 'consulting'), // typed dependency edge across files
  },
])
```

Globals use a sibling helper:

```ts
export default defineGlobalSeed('header', ({ ref }) => ({ /* HeaderGlobal data */ }))
```

## Type model

- `defineSeed<TSlug extends CollectionSlug>(slug, builder)` returns
  `RequiredDataFromCollectionSlug<TSlug>[]` (Payload's own generic, keyed to the app's
  generated types) — **except** relationship and upload fields are widened to also
  accept `Ref` / `AssetRef` tokens. This is the "change the schema → TS error" guarantee.
- `ref<C extends keyof SeedRegistry['collections']>(collection, key)` where
  `key: SeedRegistry['collections'][C]`. `SeedRegistry` is an augmentable interface
  (empty in the package; filled by codegen). When augmented, the key is checked against
  the union of declared `_key`s — remove a `_key` and every `ref()` to it errors. When
  not augmented, the registry defaults to `Record<string, string>` and refs are
  runtime-validated only. Progressive: safe without codegen, fully safe with it.
- `asset(key)` is checked against `SeedRegistry['assets']` the same way.

## Typed refs (injected into `payload-types.ts`)

To get "remove an item → TS error everywhere," the `SeedRegistry` interface must be
augmented with the declared keys:

```ts
declare module '@pro-laico/payload-seed' {
  interface SeedRegistry {
    collections: { services: 'consulting' | 'implementation'; posts: 'launch' }
    globals: 'header' | 'footer'
    assets: 'hero' | 'serviceA' | 'post'
  }
}
```

Rather than a bespoke codegen command + a separate generated file, the plugin **injects
this block into Payload's own `payload-types.ts`** via the `config.typescript.postProcess`
hook (which Payload added for "plugins that need to inject generic types JSON Schema cannot
express"). `buildSeedRegistry(definitions)` derives the unions from the in-memory
definitions the project passed to `seedPlugin` — no fs scan, no extra file. Because it rides
`payload generate:types`, it's regenerated by the same command the project already runs, and
by Payload's dev `autoGenerate` on every server boot. The augmentation lives in
`payload-types.ts`, which is always in the tsconfig `include`, so it's **global with no
import** — exactly like Payload's own `GeneratedTypes`.

The producing side (`_key`) stays a free string; only the consuming side (`ref`/`asset`) is
checked. Trade-off: the types reflect the definitions **wired into the plugin**, not a raw
filesystem scan — a non-issue when definitions are assembled in a `plugins/` barrel.

## Engine

Run order (CLI `seed()` or `POST /api/seed`):

1. **Take definitions** — the `SeedDefinition[]` passed to the plugin / `seed()`.
2. **Build asset registry** — collect every `asset(key)` used; upload sources from
   `assets/` FIRST (generalized template media logic); resolve keys → ids.
3. **Build DAG** — every `ref(collection, key)` is an edge `dependent → dependency`.
4. **Validate** — every `ref` targets a real collection and resolves to a seeded doc,
   every `asset` resolves to a declared asset, no duplicate `_key` within a collection,
   and (against the live config's `flattenedFields`) no unknown top-level field. Collects
   all issues and throws once, naming the file, key, and field. (Required-field and
   ref-target-*permission* checks are not yet done — see "Open / later".)
5. **Topo-sort** (Kahn's) — detect cycles → hard error naming the cycle.
6. **Clear** — seeded collections in reverse-dependency order. Upload collections clear
   via `payload.delete` (fires hooks / cascades, e.g. the fonts cascade); others via
   `db.deleteMany`. Versioned collections also clear versions. Read all of this from the
   config, not a hand-maintained array.
7. **Create** — in sorted order, threading created ids; resolve `ref`/`asset` tokens to
   real ids at create time. Globals updated after their dependencies.
8. **Revalidate** — best-effort `revalidateAll()` (no-op outside a request scope).

## What stays the app's responsibility

- The source assets in `assets/image|svg|font/` and their specs (alt, focal point).
- The actual seed content (the `seed.ts` files), and wiring their definitions into
  `seedPlugin({ definitions })` (e.g. via a `plugins/` barrel).
- Running `payload generate:types` after changing seed `_key`s — the same command already
  run after schema changes; it re-injects the `SeedRegistry`.

## External-asset providers

Some collections store their "file" in an external service rather than a Payload upload — e.g.
`@pro-laico/payload-mux`'s `mux-video`, whose bytes live in Mux. A **provider** lets such a
collection seed like an image asset, through the normal engine run (no script):

```ts
seedPlugin({ definitions: [videos, pages], assetProviders: [muxAssetProvider()] })

defineSeed('mux-video', ({ video }) => [{ _key: 'intro', title: 'Intro', source: video('intro.mp4') }])
defineSeed('pages', ({ ref }) => [{ _key: 'home', heroVideo: ref('mux-video', 'intro') }])
```

Responsibilities split by ownership — the **ingest** (the SDK work) lives in the owning plugin;
the **orchestration** lives here:

- **The owning plugin owns ingest.** `@pro-laico/payload-mux` accepts a server-side `source`
  (local path / URL) on its collection: a `beforeValidate` hook uploads it to Mux, waits for
  the asset to be ready, folds in the metadata, and strips `source` (it's never persisted). So
  the seed engine needs no Mux SDK and no credentials — and the same capability is reusable
  outside seeding (`ingestMuxVideo()`, for imports/migrations).
- **The engine owns orchestration.** A `SeedAssetProvider` (`{ token, collection, sourceDir }`)
  is plain config: it adds a builder source token (`video()`), resolves that token's file under
  `assetsDir/<sourceDir>` FIRST (mirroring image-asset uploads), and resolves it to
  `{ file, ...options }` — which the owning collection's hook turns into the stored asset. The
  provider collection is cleared via `payload.delete` so its `afterDelete` hook removes the
  external asset; no per-record tagging needed (the doc lifecycle owns the asset lifecycle).
- **Decoupled both ways.** The provider is structural config: the mux plugin returns it without
  importing this package, and this package consumes it without importing the mux plugin or its
  SDK. Alignment is by the `config.custom` stash + the collection's `source` contract, not types.

Adding a provider for another service = the service's plugin gains a server-side `source`
ingest + a `…AssetProvider()` helper; the seed engine is unchanged. Source-file resolution is
generic (`engine/sources.ts`); `video` / `mux-video` is the reference implementation.

> Trade-off: a reseed cleans external assets via the doc lifecycle (clear docs → `afterDelete`),
> so an external asset can orphan if the DB is wiped without a normal clear — the same property
> as Payload upload files. A deeper "delete everything in the external account" pass is left to
> the owning plugin (e.g. a dedicated dev token), not the seed engine.

## Open / later

- **Autofill** (faker-style generation of unspecified fields) — explicitly out of scope for
  now; the engine validates and orchestrates but never invents content. Possible opt-in layer.
- **Block fragments** — a `defineBlockSeed` helper (typed block data composed into a page's
  `layout`, its refs tracked) was prototyped but isn't wired into the engine; removed until
  implemented end-to-end.
- **Field-level schema validation** — required-field checks and ref-target-*permission*
  checks (does the relationship field's config actually allow that collection?) against
  `payload.collections[slug].config.fields`. Today the engine checks dangling refs, cycles,
  unknown collections, unknown top-level fields, and duplicate `_key`s — but not required
  fields, and it only checks that a ref's target collection *exists*, not that the field permits it.
