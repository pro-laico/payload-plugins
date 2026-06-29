# Changelog

All notable changes to this monorepo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). All `@pro-laico/*`
packages share one lockstep version.

## [Unreleased]

### Added

- `@pro-laico/payload-mux` — Mux Video for Payload: a `mux-video` collection that uploads
  directly to Mux, public or signed playback, virtual playback/poster/gif URLs, two-way
  delete, an admin uploader with list-view previews, and `mux/upload` + `mux/webhook`
  endpoints. Ported from `@oversightstudio/mux-video` (MIT). Adds the `mux-sandbox` example
  and a docs page.
- `@pro-laico/payload-seed` — type-safe database seeding: `seed.ts` files with typed
  cross-file `ref()` / `asset()` references, dependency ordering, media uploads, a
  `POST /api/seed` endpoint + admin button, and a `SeedRegistry` injected into
  `payload-types.ts`, all behind an `ENABLE_SEED` kill switch. Adds the `seed-sandbox`
  example and a docs page.
- Initial monorepo scaffold: pnpm workspaces + Turborepo, Biome (144-col, import
  organizing off), shared `tsconfig.base.json`, swc package builds, lockstep release
  tooling (`tools/releaser`) with a tag-triggered npm publish workflow, and a
  fumadocs documentation site.
