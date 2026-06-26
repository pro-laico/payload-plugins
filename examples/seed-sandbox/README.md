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

Create the first admin user, then seed:

```bash
pnpm --filter seed-sandbox seed        # CLI (Local API)
# or click “Seed your database” in the admin dashboard (POST /api/seed)
```

> The seed engine is still under construction — until it lands, `pnpm seed` reports
> "engine not yet implemented". This app is the harness it's built against.

## Collections

| Collection / global | Purpose |
| --- | --- |
| `users` | Auth (admin login, endpoint gate). |
| `media` | Upload target for `asset()` references. |
| `services` | Reference target (`ref('services', …)`). |
| `posts` | References a service + a hero image. |
| `site-settings` (global) | References a service + a logo. |
