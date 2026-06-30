# @pro-laico/payload-fonts — design

A self-hosted custom-fonts plugin for Payload CMS: editors upload font files, the plugin
subsets them to web-ready WOFF2s, and a build step writes the active selection to disk for
`next/font/local`. Ported from Atomic Payload's `@pro-laico/fonts` and decoupled from the Atomic
kernel, with declarative seeding added.

## Goals

1. **Upload → served WOFF2, automatically.** Editors never hand-craft `@font-face` or run a
   subsetter. They drop a file into a typeface; a save hook subsets it (harfbuzz via
   `subset-font`, metadata via `fontkit`) to a served WOFF2 and links it back.
2. **Re-derivable output.** The lossy, subsetted bytes are derived from an untouched archive
   (`fontOriginal`), so the charset can change later and everything re-subsets from source.
3. **Self-host via `next/font/local`.** A secret-gated export endpoint + a CLI write the active
   fonts to disk and generate the `localFont()` module — no third-party font CDN, no FOUT.
4. **Storage-agnostic.** Reading a font's bytes works on local disk or cloud storage (Blob/S3)
   by falling back to the URL Payload reports (`readUploadBytes`).
5. **Decoupled seeding.** A typeface seeds like an image asset through `@pro-laico/payload-seed`,
   with neither package importing the other.

## Collections

Three collections, all standard Payload primitives:

- **`font`** (visible) — one doc per **typeface**. NOT an upload collection; it holds Payload
  `upload` slots backed by `fontOriginal`: a `variable` group (upright/italic) **or** a `weights`
  array (one file per weight/style), enforced mutually exclusive. The slots render create-only
  (the `FontOriginalUpload` admin component hides "Choose from existing") so every original
  belongs to exactly one typeface — making asset cleanup race-free. A `beforeValidate` guard
  (`rejectSharedOriginals`) backstops that at the data layer for the REST API / seeds / imports.
- **`fontOriginal`** (hidden) — the raw archive of truth. No hooks → safe as a client-upload
  (direct-to-Blob) collection. MIME whitelist covers the sfnt variants browsers report for
  OTF/TTF.
- **`fontOptimized`** (hidden) — the served, subsetted WOFF2s. Derived by the `font` save hook,
  never hand-uploaded; public-read so the build-time export (no session) can fetch them.

The reconcile hook (`optimizeFromOriginalsHook`, `afterChange` on `font`) is keyed by source
original id: a new original is subsetted + created, a removed one's optimized is deleted, an
unchanged one is kept (metadata synced if its row changed). It only touches `fontOptimized`, so
it can't re-trigger itself. Delete cascades to optimized + originals (`cleanupFontAssetsHook`).

## The active selection + serving

`fontSet` (global, on by default) holds one typeface per role (sans/serif/mono/display). Both
serving paths apply it as the `--font-set{Sans,Serif,Mono,Display}` CSS variables, so a consumer
just writes `font-family: var(--font-setSans)` and the *same* CSS works in dev and prod. The two
paths never both fire (each is a no-op in the other environment), wired side-by-side in the root
layout:

- **Production — `next/font/local` (the optimized ceiling).** The `GET /api/fonts/export`
  endpoint — gated by `PAYLOAD_SECRET` (Bearer, constant-time compare) — resolves the selection to
  each role's `fontOptimized` bytes; the `payload-fonts-download` CLI (`runDownloadFonts`) fetches
  that manifest, writes `public/fonts/*.woff2`, and generates a `next/font/local` `definition.ts`
  (one `localFont()` per role). `extractFonts()` puts the generated classes on `<html>`. This keeps
  the production path **stock next/font** — precise preloading, size-adjusted fallbacks, static
  content-hashed assets — with no homegrown approximation. Any download failure resets
  `definition.ts` to an **empty** module so the build still compiles (the atomic version only wrote
  that stub when absent, so a failed run could leave a stale `definition.ts` importing files no
  longer on disk — a fresh checkout gitignores `public/fonts/` — breaking `next build`).
- **Development — `<DevFonts />` (the zero-config path).** A server component (`/DevFonts` subpath)
  that reads the active selection via `getActiveFontFaces()` and inlines the `@font-face` rules +
  the *same* `--font-set*` variables at runtime — so seeding/editing shows up on refresh with no
  build step. It renders `null` in production, and stands down in dev once `definition.ts` is
  populated, so running the CLI against a dev server previews the exact production path locally.
  Preload precision and CLS aren't a concern in dev; in prod they're next/font's, natively.

The split is deliberate: prod owns **zero** runtime font code (it's next/font), and dev owns the
convenience. The CSS-building core (`buildFontFaceCss`) is pure and unit-tested; `DevFonts` is the
thin IO wrapper.

## Server-side ingest (`source`) + seeding

The `font` collection carries a transient `source` JSON field. When set to
`{ file, weight?, style?, variable? }`, a `beforeValidate` hook (`getFontSourceHook`, ordered
*before* the file-presence guards) reads the file (local path or `http(s)` URL), uploads it to
`fontOriginal`, wires the right slot, and strips `source` — so a typeface can be created from a
file with no browser uploader. `ingestFont(payload, …)` is the programmatic entry; imports and
migrations use the same seam.

Seeding rides that seam through `@pro-laico/payload-seed`, mirroring the Mux plugin's provider
pattern:

- `fontAssetProvider()` returns the structural `SeedAssetProvider` shape
  (`{ token: 'font', collection: 'font', sourceDir: 'fonts' }`). The seed engine resolves the
  token's file under `<assetsDir>/fonts/` first (like image-asset uploads) and clears the `font`
  collection via `payload.delete` so its `afterDelete` cascade removes the originals + optimized.
- `fontSource('inter.woff2', { weight, style, variable })` is a `SourceRef`-shaped token the
  engine resolves to `{ file: <abs path>, ...options }` — exactly the `source` value the hook
  consumes. It's exported from THIS package, so the seed engine needs zero font-specific code.
- The `fontSet` global is seeded with the ordinary `ref('font', _key)` token, so the active
  selection is wired declaratively alongside the typefaces.

Decoupled both ways: the seed package never imports this one (nor `fontkit`/`subset-font`), and
this package consumes nothing from the seed package — alignment is the `source` field contract
plus the structural provider/token shapes.

## What was dropped from the Atomic port

- **`@pro-laico/core`** — `mergeCollection` / `mergeGlobal` / `mergeHooks` are vendored locally
  (`lib/mergeConfig.ts`); the core-typed schema-augment stubs are removed.
- **`@pro-laico/styles` design set** — the export endpoint's "prefer the active designSet's font
  group" branch is gone; it reads the `fontSet` global only.
- **Env-var branding** — `ATOMIC_FONTS_*` → `PAYLOAD_FONTS_*`; the bin is `payload-fonts-download`.

## Open / later

- **Multi-weight seeding from one token.** `fontSource` seeds one file → one slot (a static
  weight or a variable upright/italic). A typeface with many static weights is still expressible
  through several typefaces or the admin UI; a future token could carry an array of files.
- **`@font-face` CSS endpoint for non-Next consumers.** `<DevFonts />` covers the Next dev path;
  `buildFontFaceCss()` (pure) + `getActiveFontFaces()` are exported so a project on another
  framework can serve the same `@font-face` CSS from its own route. A first-party
  `GET /api/fonts/css` endpoint could wrap them, with cache headers, for a fully framework-agnostic
  runtime path.
