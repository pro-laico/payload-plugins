# seed-sandbox

A minimal, self-contained Payload + Next.js app for testing
[`@pro-laico/payload-seed`](../../packages/payload-seed). Loosely modeled on the
service-template's content model but stripped to the essentials: SQLite (no external
DB), local-disk uploads, and just enough collections to exercise every seed feature.

## What it exercises

- **Typed seed data** — `src/collections/**/seed.ts` author records with `defineCollectionSeed`,
  typed against this app's generated `payload-types.ts`.
- **Upload files** — `src/seed/media.ts` seeds `media` upload docs that carry their source file
  on `_file` via `file('service-a.jpg')`; other docs reference them with `ref('media', …)`.
- **Cross-file doc references** — `Posts/seed.ts` and `SiteSettings/seed.ts` point at
  Services docs with `ref('services', 'consulting')`, creating the dependency edges the
  engine sorts on.
- **Globals** — `site-settings` seeded via `defineGlobalSeed`.
- **Run infra** — the plugin's `POST /api/seed` endpoint + the admin SeedButton, plus a
  CLI runner (`pnpm seed`), both behind the `ENABLE_SEED` guard.

## Setup

```bash
cp .env.example .env.local            # local SQLite + ENABLE_SEED=true
pnpm install                           # from the repo root
pnpm --filter seed-sandbox generate:types     # Payload types + injected SeedRegistry
pnpm --filter seed-sandbox generate:importmap
pnpm --filter seed-sandbox dev         # http://localhost:3050/admin
```

Create the first admin user, then seed one of two ways:

- **Admin dashboard** — click **“Seed your database”** (`POST /api/seed`). Reliable on every
  platform (runs in Next's runtime).
- **CLI** — `pnpm seed`, which runs `payload seed` (a command the plugin registers, no
  per-project runner script).

> **Known caveat (this example):** `payload seed` boots Payload via Payload's `tsx`-based
> CLI, and on Node 24 + tsx 4.22.4 (current latest) the `@payloadcms/db-sqlite` adapter's
> `node:crypto` import trips a tsx loader bug (`ENOENT … node:crypto?tsx-namespace=…`) — the
> same bug that affects any `payload run` script here. It's an upstream tooling issue, not
> the plugin: the seed engine itself boots Payload and seeds correctly under the test
> runner's loader (see the integration test), and the admin button is unaffected. Projects
> on other adapters/Node versions can use `pnpm seed` directly.

## Tests

```bash
pnpm --filter seed-sandbox test
```

An integration test (`tests/seed.int.spec.ts`) boots this config against a temporary
SQLite DB and runs the real engine via the Local API — the automated analog of the admin
button. It asserts the seeded counts, that cross-file `ref()` tokens and each doc's `_file`
resolve to real ids, the topological create order, and idempotency (re-running clears +
recreates without duplicating).

## Type-safe refs (in `payload-types.ts`)

There's no separate seed codegen step. `src/plugins/index.ts` imports the seed definitions
and hands them to `seedPlugin({ definitions: [...] })`. From those, the plugin injects a
`SeedRegistry` augmentation directly into `payload-types.ts` via Payload's
`typescript.postProcess` hook — so it rides `payload generate:types` (and Payload's dev
`autoGenerate`, which reruns on every server boot).

That augmentation type-checks `ref('services', 'consulting')` against the declared `_key`s.
It's global (like Payload's own `GeneratedTypes`) — no import needed.
Rename or remove a seeded item and every stale reference becomes a TS error. Try it: change
a `_key` in a `seed.ts` file, rerun `generate:types`, and `pnpm typecheck`.

## Collections

| Collection / global | Purpose |
| --- | --- |
| `users` | Auth (admin login, endpoint gate). |
| `media` | Upload docs (each carries its file on `_file`), referenced via `ref('media', …)`. |
| `services` | Reference target (`ref('services', …)`). |
| `posts` | References a service + a hero image. |
| `site-settings` (global) | References a service + a logo. |
