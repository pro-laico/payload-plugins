# Changelog

All notable changes to this monorepo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). All `@pro-laico/*`
packages share one lockstep version.

## [Unreleased]

## [0.1.0] - 2026-07-02

### Added

- `@pro-laico/payload-dev-tools` — build Payload projects faster: a floating dev toolbar,
  `/dev` pages inside your app (one catch-all drop-in file via `createDevPage`), cookie-staged
  A/B test and header/footer variant previews (`defineTest` / `resolveDevChrome`), and a
  machine-readable app snapshot (`GET /api/dev`) for AI agents. Dev-only — disappears in
  production. Adds a docs page.
- `@pro-laico/payload-fonts` — custom fonts for Payload: a Font typeface collection that
  subsets uploaded files (including italics) to served WOFF2s, an optional active-font
  global, an export endpoint + `payload-fonts-download` CLI that writes the active fonts to
  disk for `next/font/local`, and declarative seeding. Adds the `fonts-sandbox` example and
  a docs page.
- `@pro-laico/payload-icons` — SVG icons for Payload: an Icon upload collection that
  optimizes and sanitizes SVGs on save (svgo + viewBox tightening + `currentColor` theming),
  a drop-in `<Icon name>` server component that inlines the SVG, a `payload-icons-scan` CLI,
  and one-line declarative seeding via `@pro-laico/payload-seed`. Adds the `icons-sandbox`
  example and a docs page.
- `@pro-laico/payload-images` — on-demand image optimization for Payload: an Images upload
  collection that stores only the original, a Sharp transform endpoint (focal-aware crop,
  format negotiation, built-in LQIP placeholders), a durable variant cache with two-way
  purge, an admin focal-point picker, and a responsive `<ResponsiveImage>` component. Adds
  the `images-sandbox` example and a docs page.
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
