# fonts-sandbox

A minimal, self-contained Payload + Next.js app for testing
[`@pro-laico/payload-fonts`](../../packages/payload-fonts). SQLite (no external DB), local-disk
uploads, and the plugin wired alongside [`@pro-laico/payload-seed`](../../packages/payload-seed)
so the four bundled sample typefaces seed end to end — no external services required.

## Setup

```bash
cp .env.example .env.local                        # SQLite + a dev PAYLOAD_SECRET
pnpm install                                       # from the repo root
pnpm --filter fonts-sandbox generate:types         # Payload types
pnpm --filter fonts-sandbox generate:importmap     # admin import map
pnpm --filter fonts-sandbox dev                     # http://localhost:3947/admin
```

Create the first admin user, then open **Fonts**. Add a typeface, drop in a variable file or
per-weight files, and the save hook subsets each to a served WOFF2 (visible on the hidden
`fontOptimized` collection). Pick the active faces in the **fontSet** global.

## What it exercises

- **The Font collection** — the plugin's `font` typeface plus the hidden `fontOriginal` (raw
  uploads) and `fontOptimized` (served WOFF2s); the create-only upload slots; the subset +
  cascade hooks.
- **The fontSet global** — the active sans/serif/mono/display selection the export endpoint ships.
- **The export endpoint** — `GET /api/fonts/export` (secret-gated), the source for the
  `payload-fonts-download` CLI.

## Seeding fonts from local files

This sandbox wires up the seed plugin so fonts seed by the normal seed flow, no custom script.
`fontOriginal` is a plain upload collection, so `src/seed/fonts.ts` seeds the raw font files into
`fontOriginal` **natively** and each `font` typeface **refs** its original with `ref('fontOriginal', …)`;
the collection's save hook subsets it into a served WOFF2. See `src/plugins/index.ts` (the seed plugin
uses `assetSubDirs: { fontOriginal: 'font' }` so the files resolve from `seed-assets/font/`),
`src/seed/fonts.ts` (four typefaces + their originals), and `src/seed/fontSet.ts` (the active selection
wired with `ref('font', …)`).

```bash
# Set ENABLE_SEED=true, start the app, and click "Seed your database" in the admin header
# (or POST /api/seed). The seed uploads each font to fontOriginal, subsets it to fontOptimized,
# and points the fontSet global at the four typefaces.
```

Under the hood the seed engine resolves each record's `_file` to the file under `seed-assets/font/`
and hands it to the `font` collection, whose `beforeValidate` hook uploads it and wires the slot —
the seed engine needs no font-specific code. Reseeds clear the `font` collection via
`payload.delete`, so its `afterDelete` cascade removes the old originals + optimized too
(idempotent). For one-off programmatic creation, the plugin also exports `ingestFont()`.

## Rendering the fonts (dev vs. prod)

The home page applies fonts with `font-family: var(--font-set{Sans,Serif,Mono,Display})`, and
`src/app/(frontend)/layout.tsx` provides those variables two ways that never both fire:

- **Development** — `<DevFonts />` reads the active `fontSet` from Payload and inlines the matching
  `@font-face` + `--font-set*` variables at runtime. Seed (or edit a font), refresh, and it renders
  immediately — no build step. This is what you see when you run `pnpm dev`.
- **Production** — `next/font/local`. `pnpm prebuild` runs `payload-fonts-download`, which fetches
  the active fonts from `/api/fonts/export`, writes `public/fonts/*.woff2` + `src/app/definition.ts`,
  and `extractFonts` puts the generated classes on `<html>`. `<DevFonts />` renders nothing here.

`src/app/definition.ts` is committed as an **empty baseline** so the layout import resolves without
a build; a prod build overwrites it. To preview the real production path locally, run
`pnpm --filter fonts-sandbox generate:fonts` against the running dev server — the definition fills
in and `<DevFonts />` stands down.

## Tests

```bash
pnpm --filter fonts-sandbox test
```

`tests/fonts.int.spec.ts` boots this config against a temporary SQLite DB and drives the real
seed engine end to end: `file()` tokens on `_file` → the ingest hook uploads to `fontOriginal` → the
optimize hook subsets to `fontOptimized` → the `fontSet` global is wired by `ref()` → the export
endpoint returns the served WOFF2 bytes per role (and rejects a bad secret).

## Collections

| Collection / global | Purpose |
| --- | --- |
| `users` | Auth (admin login, the default font read/write gate). |
| `font` | Added by the plugin — the visible typeface collection. |
| `fontOriginal` | Hidden — raw uploaded font files. |
| `fontOptimized` | Hidden — served, subsetted WOFF2s. |
| `fontSet` (global) | The active sans/serif/mono/display selection. |

The bundled `seed-assets/font/*.woff2` are open-source (OFL) Google fonts — see
`seed-assets/font/LICENSES.md`.
