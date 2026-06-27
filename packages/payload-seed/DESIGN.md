# @pro-laico/payload-seed — design

A schema-aware, type-safe seeding plugin for Payload CMS. It replaces the
hand-maintained seed orchestrator pattern (one big `index.ts` that hardcodes the
collection list, clear order, create order, and prop-drills returned docs) with a
declarative, auto-discovered, dependency-tracked system that **stays aligned with the
schema by construction** — drift surfaces as a TypeScript error or a precise runtime
error, never as a silent omission.

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
   everywhere it's used (via a generated `SeedRegistry` — see Codegen).
3. **Strong dependency tracking.** Collections, globals, and blocks can all reference
   collection docs. Every reference is an explicit edge. The engine builds a DAG,
   detects cycles, and topologically sorts the seed order — so an AI (or a human)
   editing one file cannot produce a dangling reference or a wrong order.
4. **Reviewable graph.** After every seed, emit a self-contained `graph.html`
   (Mermaid diagram of doc- and collection-level edges + the computed seed order) plus
   a `graph.json` sidecar for tooling.
5. **Reusable run infra.** Ship the endpoint (`POST /api/seed`), the `ENABLE_SEED`
   kill-switch guard, and an optional admin SeedButton — so a consuming app gets the
   whole seed surface from installing one plugin.
6. **Robust media.** Carry over the template's hard-won upload logic: upload-first,
   MIME-by-real-extension, extension-mismatch tolerance, sequential uploads sharing one
   `req`, missing-file guards, focal points.

## Public API

```ts
// payload.config.ts
import { seedPlugin } from '@pro-laico/payload-seed'

export default buildConfig({
  plugins: [
    seedPlugin({
      enabled: process.env.ENABLE_SEED === 'true', // gates the endpoint (guard still applies)
      discover: ['src/**/seed.ts'],                // auto-discovery globs (default)
      assets: { dir: 'assets' },                   // media registry root
      authorize: (user) => user.role === 'admin',  // endpoint authorization (default: any authed user)
      graph: { output: '.seed/graph.html' },       // dependency artifact (set false to disable)
      adminButton: true,                           // inject the SeedButton on the dashboard
    }),
  ],
})
```

```ts
// src/collections/Services/seed.ts  (auto-discovered)
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
// src/collections/Posts/seed.ts  (a different, auto-discovered file)
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

Globals and blocks use sibling helpers:

```ts
export default defineGlobalSeed('header', ({ ref }) => ({ /* HeaderGlobal data */ }))
export default defineBlockSeed('hero',   ({ asset }) => ({ /* HeroBlock fragment */ }))
```

A block seed is a typed fragment composed into a page's `layout`; its `ref`/`asset`
tokens propagate into the parent page's dependency set, so a block that references a
collection doc is tracked automatically.

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

## Codegen (the cross-file safety bridge)

Auto-discovery is a runtime fs scan; the compiler can't see it. To get
"remove an item → TS error everywhere," a small generate step scans the `seed.ts`
files, extracts each `_key` / asset key literal, and writes a `SeedRegistry`
augmentation:

```ts
// seed.generated.ts  (committed; regenerated on schema/seed change)
declare module '@pro-laico/payload-seed' {
  interface SeedRegistry {
    collections: { services: 'consulting' | 'implementation'; posts: 'launch' }
    globals: 'header' | 'footer'
    assets: 'hero' | 'serviceA' | 'post'
  }
}
```

**Implemented** as `generateSeedTypes()`, which the plugin registers as a `payload
generate:seed-types` command through Payload's `config.bin` — the same plumbing as `payload
generate:types`, so consumers just run `pnpm payload generate:seed-types` with no bespoke script.
Payload's bin loads the config and calls the command WITHOUT booting Payload/a DB, so it
avoids the local-API runtime issues. It reads the
keys by importing the definitions and reading their actual data (the same mechanism the
engine uses), so the types always match what gets seeded. It writes the augmentation **and**
the `definitions` barrel in one file. The producing side (`_key`) stays a free string; only
the consuming side (`ref`/`asset`) is checked — exactly "if a referenced item is removed, it
errors at every use." A drift test fails if the generated file is stale.

## Engine

Run order (CLI `seed()` or `POST /api/seed`):

1. **Discover** — glob + import all seed definitions (collections, globals, blocks).
2. **Build asset registry** — collect every `asset(key)` used; upload sources from
   `assets/` FIRST (generalized template media logic); resolve keys → ids.
3. **Build DAG** — every `ref(collection, key)` is an edge `dependent → dependency`.
   Block fragments contribute their refs to their host page node.
4. **Validate against live schema** — read `payload.collections[slug].config.fields`:
   required fields present, no unknown fields, every `ref` target collection is allowed
   by the relationship field's config, every `ref`/`asset` key resolves. Errors name the
   file, key, and field.
5. **Topo-sort** (Kahn's) — detect cycles → hard error naming the cycle.
6. **Clear** — seeded collections in reverse-dependency order. Upload collections clear
   via `payload.delete` (fires hooks / cascades, e.g. the fonts cascade); others via
   `db.deleteMany`. Versioned collections also clear versions. Read all of this from the
   config, not a hand-maintained array.
7. **Create** — in sorted order, threading created ids; resolve `ref`/`asset` tokens to
   real ids at create time. Globals updated after their dependencies.
8. **Emit graph** — `graph.html` (Mermaid) + `graph.json`.
9. **Revalidate** — best-effort `revalidateAll()` (no-op outside a request scope).

## What stays the app's responsibility

- The source assets in `assets/image|svg|font/` and their specs (alt, focal point).
- The actual seed content (the `seed.ts` files).
- Running `payload-seed generate` after changing seed `_key`s (like `generate:types`).

## Open / later

- **Autofill** (faker-style generation of unspecified fields) — explicitly out of v1;
  v1 validates and orchestrates but never invents content. Possible opt-in layer later.
- Discovery is fs-based; a future explicit-registry mode could drop the fs scan for apps
  that prefer a single import barrel.
