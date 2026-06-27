# seed-sandbox

A minimal, self-contained Payload + Next.js app for testing
[`@pro-laico/payload-seed`](../../packages/payload-seed). Loosely modeled on the
service-template's content model but stripped to the essentials: SQLite (no external
DB), local-disk uploads, and just enough collections to exercise every seed feature.

## What it exercises

- **Typed seed data** — `src/collections/**/seed.ts` author records with `defineSeed`,
  typed against this app's generated `payload-types.ts`.
- **Asset references** — `src/seed/assets.ts` declares the uploadable assets; seed files
  reference them with `asset('serviceA')`.
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
pnpm --filter seed-sandbox generate:types     # Payload types
pnpm --filter seed-sandbox generate:seed-types  # SeedRegistry + definitions barrel
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
button. It asserts the seeded counts, that cross-file `ref()`/`asset()` tokens resolve to
real ids, the topological create order, and idempotency (re-running clears + recreates
without duplicating).

## Codegen: type-safe refs + the definitions barrel

`pnpm generate:seed-types` runs `payload generate:seed-types` — a command the **plugin
registers** via Payload's `config.bin` (the same plumbing as `payload generate:types`, so
no separate script or `tsx` dependency). It scans the seed files and writes
`src/seed.generated.ts`, which does two things:

1. **Augments `SeedRegistry`** with each collection's declared `_key`s (plus global and
   asset keys), so `ref('services', 'consulting')` is type-checked — rename or remove a
   seeded item, regenerate, and every stale reference becomes a TS error. (Try it: change a
   `_key` and run `pnpm typecheck`.)
2. **Exports a `definitions` barrel** of static imports. Auto-discovery (globbing `seed.ts`
   and importing) works in the Local API / CLI / test paths — the integration test relies
   on it — but the **bundled Next server** can't dynamically import source files at runtime,
   so `payload.config.ts` feeds the generated barrel to `seedPlugin({ definitions })`.

Rerun `generate:seed-types` after changing any `_key`, global, or asset key (the test suite
has a drift check that fails if you forget).

## Collections

| Collection / global | Purpose |
| --- | --- |
| `users` | Auth (admin login, endpoint gate). |
| `media` | Upload target for `asset()` references. |
| `services` | Reference target (`ref('services', …)`). |
| `posts` | References a service + a hero image. |
| `site-settings` (global) | References a service + a logo. |
