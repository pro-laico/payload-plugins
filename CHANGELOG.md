# Changelog

All notable changes to this monorepo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). All `@pro-laico/*`
packages share one lockstep version.

## [Unreleased]

## [0.3.0] - 2026-07-15

A `@pro-laico/payload-images` release. The plugin gains a read-side render contract — you
declare the render on the fetch and get a paintable placeholder and ready-to-spread doc back —
plus named presets, a per-image variant cap, smart prewarming, and an instant nearby-quality
fallback that together make a public transform endpoint both fast and bounded. Its public surface
is cut roughly in half. `@pro-laico/payload-revalidate` adds one-call cached finders. Several
breaking changes; all are pre-1.0 minor and every one has a migration path — see **Upgrade notes**.

### Highlights

#### payload-images: the read-side render contract

Declare the render where you fetch, and the plugin does the rest. `createImageFor` seeds a
fetch helper once with your app's Payload handle (`createImageFor(getPayload({ config }))` — the
promise is fine as-is); then `imageFor(id).aspectRatio('16:9').blur('md').fetch()` runs the
declared read and resolves a render-ready doc (`{ id, alt, src, srcset, placeholder }`) that
spreads straight into `<ResponsiveImage>`. A whole render can seed the chain in one go
(`imageFor(id, { image, blur })`), and chains are immutable, so a partially-applied one can be
shared and branched. The virtual placeholder field it feeds is now named `placeholder` (was
`croppedBlurHash`) and always answers a declared render with a finished, paintable data URI.

#### payload-images: presets, a per-image variant cap, and eager generation

A per-image `variantLimit` (default 200; project default via `imagesPlugin({ variantLimit })`)
closes the public endpoint's unbounded-storage vector — past the cap a new freeform size is served
from a nearby existing variant or generated-but-not-stored, so a public URL can't accumulate
unbounded files. **Presets** are the exemption: named, cap-exempt variants
(`imagesPlugin({ presetTemplates })`, a default `og` 1200×630 ships) that editors toggle onto
images by name in a new admin panel, seed as plain data, and serve via
`/api/img/:id?preset=<name>` (or `getImageUrl(doc, { preset: 'og' })`). Presets honor exact
dimensions and are pre-generated on upload / file / focal change, so a cold social crawler never
races generation. New `./admin/presetManager` export.

#### payload-images: prewarming + instant nearby-quality fallback

Two features that make transform cache misses rare, then instant. **Smart prewarming**
(`prewarm: true | {...}`, default off) learns which renders the site actually serves — browser-chosen
widths, real fit/quality/format, recorded off the serving path into a hidden
`image-render-profiles` collection — and pre-generates exactly those variants for new /
file-replaced / re-focused images via a deferred, idempotent `imagesPrewarm` Payload Job (budgeted,
deduped against organic traffic, enqueued 30s out so purges land first). Ships an opt-in `autoRun`
cron and a `payload images:prewarm` CLI (`--now` for runner-less bulk warms). The **nearby-quality
fallback** (default on) covers the residual misses: a miss with a same-geometry variant already
generated (identical crop, any quality/width/format) serves those bytes instantly with
`Cache-Control: no-store` while the exact variant generates in the background, so the accurate
image takes over on the very next request. Disable with `transform: { fallback: false }`.

#### payload-revalidate: one-call cached finders

`createCacheHelpers` gains `findDoc`, `findDocByID`, `findIds`, and `findGlobal` — each runs the
Payload query AND tags the entry in one call inside your `'use cache'` getter, shrinking a getter
body to a line and typing the collection once. Atomic defaults are baked in (`depth: 0`,
`overrideAccess: false`, errors → `null`; `findIds` forces `select: {}` so an id-list can never
cache content) with full local-API passthrough, results typed from your generated `payload-types`,
one `draft` flag driving both fetch and `:draft` tag variants, and pagination meta from `findIds`
without a second query. `user`/`req` are refused (types + runtime) — a shared cache entry must
never hold a requester-scoped read. The low-level `cacheDoc` / `cacheIds` / `cacheGlobal`
primitives stay exported for getters the finders can't express.

### Added

- `@pro-laico/payload-images` — `createImageFor` fetch helper, per-image `variantLimit` +
  cap-exempt named presets (`./admin/presetManager`), smart prewarming (`prewarm`, `autoRun`
  cron, `payload images:prewarm` CLI), and the nearby-quality transform fallback. See Highlights.
- `@pro-laico/payload-revalidate` — one-call cached finders (`findDoc` / `findDocByID` /
  `findIds` / `findGlobal`) on `createCacheHelpers`. See Highlights.
- `@pro-laico/payload-revalidate` — declared list scopes accept a `string[]` shorthand:
  `lists: { featured: ['featured', 'publishedAt'] }`. The `{ fields: [...] }` object form still
  works and remains the extension slot.

### Changed

- **BREAKING** `@pro-laico/payload-images` — the public surface is cut roughly in half. What
  examples and docs teach is untouched (`imagesPlugin`, `createImageFor`, `RESPONSIVE_IMAGE_SELECT`,
  `<ResponsiveImage>`, `getImageUrl`, `buildSrcset`); the removed names were internals leaking out:
  - `transform` config loses its duplicate/dead knobs — `transform.presetTemplates` (silently
    ignored; the top-level option always won), `transform.variantLimit` (duplicated the top-level
    option), `transform.sourceSlug` (a near-alias of `extendCollection`), and `transform.variantSlug`
    (renamed an internal cache collection). Use the top-level `variantLimit` / `presetTemplates` /
    `extendCollection`; the cache collection is always `generated-images`.
  - `buildSrcset` now takes an id **or a populated doc** and derives the width cap + cache-busting
    `v` token itself — `buildSrcset(doc, { aspectRatio: '16:9' })` is the whole call (returns `null`
    for an empty resource). The `sourceWidth` option and the lower-level pieces it made you thread
    (`buildVariantUrl`, `deriveVersion`, `stepWidths`, `DEFAULT_TRANSFORM_API_PATH`, `VersionSource`)
    leave `/utils/urls`.
  - `focalUI` absorbs `previewRatios` (`focalUI: { previewRatios: [...] }` replaces the top-level
    option); an array `pixelStep`'s widths now pass the endpoint's snap exactly, dropping the
    "multiples of 50" caveat and the `transform.dimensionStep` escape hatch.
  - The main entry stops exporting placeholder/preset internals nobody consumed (`coverCropWindow`,
    `cropBlurhashCoefficients`, `blurhashToPngDataUri`, `BLURHASH_QUALITIES`, `WEBP_QUALITIES`,
    `DEFAULT_BLURHASH_QUALITY`, `DEFAULT_PRESET_TEMPLATES`, `DEFAULT_VARIANT_LIMIT`,
    `IMAGE_RENDER_PROFILES_SLUG`, and the types `CropWindow`, `BlurhashRequest`, `BlurhashQuality`,
    `WebpQuality`, `PrewarmReason`, `ImageGetter`, `PresetTemplate` — use `PresetSpec`). The render
    contract + palette types (`PlaceholderQuality` / `PlaceholderFormat` / `ImagePalette` /
    `PaletteSwatch`) and `PREWARM_TASK_SLUG` stay; `ResponsiveImage` is now a named export only.

    _Migrate by:_ replacing any use of the removed knobs/exports with the top-level options and
    `PresetSpec` above, and importing `ResponsiveImage` by name.

- **BREAKING** `@pro-laico/payload-images` — the virtual `croppedBlurHash` field is now
  `placeholder` (the old name matched neither what it returns — a finished data URI for declared
  renders — nor the `<ResponsiveImage>` prop it feeds). The field is virtual, so nothing is stored
  under the old name. _Migrate by:_ updating any code reading `doc.croppedBlurHash` (selects via
  `RESPONSIVE_IMAGE_SELECT` already carry the new name), then regenerating your payload types.

- **BREAKING** `@pro-laico/payload-images` — the default `pixelStep` is now a conventional width
  ladder (`[640, 750, 828, 1080, 1200, 1920, 2048, 3840]`, next/image's deviceSizes) instead of a
  dense 50px grid: a wide original emits ~8 `srcset` URLs per read instead of ~82, and the
  stored-variant space per image shrinks accordingly. Freeform widths still snap to the 50px
  anti-DoS grid. _Migrate by:_ nothing required — old variant files remain valid; pass
  `pixelStep: 50` to restore the old dense behavior.

- **BREAKING** `@pro-laico/payload-images` — replacing an image's bytes under the same filename
  (`overwriteExistingFiles`, the admin crop tool) now purges stale variants and busts caches:
  `filesize`/`width`/`height` participate in the variant identity, the cache key, and the `v=`
  version token in lockstep. _Migrate by:_ nothing required — existing cache keys and version
  tokens change once on upgrade; variants regenerate on first request (or next prewarm) and CDN
  caches bust once.

- `@pro-laico/payload-images` — `generated-images` read access now requires an authenticated user
  AND defers to the source collection's read access (re-rooted through the `source` relationship),
  so a tenant-scoped or owner-only source policy protects the cached variant docs and bytes too —
  previously any logged-in user could read every variant. Override stays available via
  `generatedImagesOverrides.access.read`.

### Removed

- **BREAKING** `@pro-laico/payload-revalidate` — internal shapes are no longer exported from the
  package root: `createTags`, `readRevalidateMarker`, and the types `PayloadRevalidateMarker`,
  `ResolvedRevalidateOptions`, `CollectionSettings`. _Migrate by:_ replacing `createTags(prefix)`
  with `tagsFor(payload)` (prefix-safe); the lane-aware `revalidateDoc` / `revalidateList` /
  `revalidateGlobal` busters are almost always the better tool, and nothing else had a supported use.

### Fixed

- `@pro-laico/payload-images` — full audit-findings pass: the fallback picker no longer serves
  cross-crop-family or hotspot-mismatched stand-ins (ratio-drift gate, persisted `windowed` render
  path, webp only for webp-capable clients, achievable-width floor for cropped sources, png-quality
  tie-break); transform cache misses no longer hold original Buffers while queued and same-key
  requests coalesce across the endpoint AND the prewarm job through the deferred-persist window;
  the prewarm recorder no longer drops or double-counts observations under concurrent flushes; a
  save landing while a pending prewarm job is picked up re-defers that job instead of stranding the
  new identity; `prewarm.formats` is validated against `transform.formats`; `buildVariantUrl`
  accepts numeric ids and never emits `h=0`; `imagesOverrides` / `generatedImagesOverrides` can no
  longer desync internals via `slug`; `extendCollection` throws a plugin-attributed error on
  field-name collisions; `imageFor()` resolves `null` instead of rejecting when the plugin isn't
  registered; the SSRF guard catches IPv4 addresses smuggled in IPv6 literals
  (`::ffff:169.254.169.254` and hex/compat forms); `readPluginMarker`, the marker types, and both
  collection slugs are now exported.

- `@pro-laico/payload-images` — a read that declared an **empty** render (`context: { image: {} }`,
  or a natural-ratio render with no `blur`) got the raw `sm` blurhash as its `placeholder` instead
  of a data URI; `<ResponsiveImage>` then painted the hash as a CSS `url()`, firing a garbage
  request per image (`GET /LJJtSD~p…` → 404). Any declared render now answers with a paintable data
  URI, and `<ResponsiveImage>` refuses to paint a non-URI placeholder.

- `@pro-laico/payload-images` — the admin Presets panel read the `presets` array through
  `useField(path)`, whose value on a loaded doc is the row *count*, not the rows: saved presets were
  invisible after reload. The panel now reads and mutates rows through the form's rows API
  (`useAllFormFields` + `addFieldRow` / `removeFieldRow`), so add → save → reload → remove
  round-trips.

- All packages — every editor-facing collection (Images, Icons, Icon sets, Fonts, Mux videos) and
  the internal asset caches now set `admin.enableListViewSelectAPI: true`, so the list view queries
  only the columns it renders instead of whole documents — a real win on the large variant-cache
  tables. Custom thumbnail cells that read non-column fields keep working via `forceSelect`.

### Docs

- New docs-wide `<Flow>` process diagrams — a read-only React Flow canvas (data-driven nodes/edges,
  themed light/dark, pan/pinch-zoom) with 10 flows across 6 plugins where the docs narrate a
  process (transform pipeline, revalidate read/write loops, font subsetting, seed sequence, …).
- Readability refactor — split the plugin docs into focused pages with a per-plugin Reference and a
  shared Conventions page.
- Accuracy audit — fixed 22 doc/source mismatches across 5 plugins.

### Upgrade notes

1. Run `pnpm install` (or your package manager's equivalent) to pull the new versions.
2. `@pro-laico/payload-images`: rename any `doc.croppedBlurHash` reads to `doc.placeholder`, import
   `ResponsiveImage` as a named export, and swap the removed `transform`/`buildSrcset` knobs and
   internal exports for the top-level options and `PresetSpec` (see Changed), then **regenerate your
   payload types**.
3. `@pro-laico/payload-revalidate`: replace `createTags(prefix)` with `tagsFor(payload)`.
4. No data migration is required — existing image variants stay valid; a byte-replaced image's
   caches bust once and its variants regenerate on first request.

## [0.2.0] - 2026-07-09

### Added

- `@pro-laico/payload-revalidate` — surgical Next.js cache revalidation for Payload (App
  Router, Cache Components): auto-attached hooks that bust exactly the tags a change touches
  (doc tags always, scoped list tags only when a declared field or membership changes, draft
  saves only the draft lane), atomic `cacheDoc` / `cacheIds` / `cacheGlobal` read helpers
  that keep references id-keyed and walk fetched values to tag every embedded doc, join-aware
  membership busts (`{child}:join:{on}:{parentId}`), a schema-derived dependency map at
  `GET /api/revalidate-map` (rendered by `@pro-laico/payload-dev-tools` at `/dev/revalidate`),
  and one precise flush at the end of a `@pro-laico/payload-seed` run. Requires `next >= 16`
  with `cacheComponents: true`. Adds the `revalidate-sandbox` example and a docs page.
- `payload revalidate-map` — a `@pro-laico/payload-revalidate` CLI (Payload custom bin) that
  prints a project's cache dependency map — tag vocabulary, per-collection blast radius, and
  the full reference graph — as Markdown or JSON, straight from the config with no server
  booted. Handy for a committed `REVALIDATION.md` or as context for an AI working in the repo.
  Exposed programmatically as `renderRevalidateMap(buildStaticInspection(config))`.

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
