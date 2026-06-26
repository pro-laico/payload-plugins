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
pnpm --filter seed-sandbox generate:types
pnpm --filter seed-sandbox generate:importmap
pnpm --filter seed-sandbox dev         # http://localhost:3050/admin
```

Create the first admin user, then seed by clicking **“Seed your database”** on the admin
dashboard (`POST /api/seed`).

## Tests

```bash
pnpm --filter seed-sandbox test
```

An integration test (`tests/seed.int.spec.ts`) boots this config against a temporary
SQLite DB and runs the real engine via the Local API — the automated analog of the admin
button. It asserts the seeded counts, that cross-file `ref()`/`asset()` tokens resolve to
real ids, the topological create order, and idempotency (re-running clears + recreates
without duplicating).

## Auto-discovery vs. the bundled server

Auto-discovery (globbing `seed.ts` files and importing them) works in the Local API / CLI
/ test paths — the integration test relies on it. The **bundled Next server**, though,
can't dynamically import source files at runtime, so the in-app endpoint is fed the
definitions explicitly: `src/seed/index.ts` is a small barrel that imports each definition
and is passed to `seedPlugin({ definitions })` in `payload.config.ts`. (A future
`payload-seed generate` step will write that barrel automatically.)

## Collections

| Collection / global | Purpose |
| --- | --- |
| `users` | Auth (admin login, endpoint gate). |
| `media` | Upload target for `asset()` references. |
| `services` | Reference target (`ref('services', …)`). |
| `posts` | References a service + a hero image. |
| `site-settings` (global) | References a service + a logo. |
