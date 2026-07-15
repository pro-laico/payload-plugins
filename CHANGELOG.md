# Changelog

All notable changes to this monorepo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). All `@pro-laico/*`
packages share one lockstep version.

## [Unreleased]

### Added

- `@pro-laico/payload-revalidate` — cached finders on `createCacheHelpers`: `findDoc`,
  `findDocByID`, `findIds`, `findGlobal` run the Payload query AND tag the entry in one call
  inside your `'use cache'` getter, so a getter body shrinks to one line and the collection is
  typed once. Atomic defaults are baked in — `depth: 0`, `overrideAccess: false`, errors → `null`,
  and `findIds` forces `select: {}` so an id-list can never accidentally cache content — with full
  local-API passthrough (`where`, `sort`, `locale`, `select`, `populate`, `context`, …), returns
  typed from your generated `payload-types`, a single `draft` flag driving both the fetch and the
  `:draft` tag variants, and pagination meta returned by `findIds` without a second query.
  `user`/`req` are refused (types + runtime) — a shared cache entry must never hold a
  requester-scoped read. The low-level `cacheDoc` / `cacheIds` / `cacheGlobal` primitives stay
  exported for getters the finders can't express.

- `@pro-laico/payload-revalidate` — declared list scopes accept a `string[]` shorthand:
  `lists: { featured: ['featured', 'publishedAt'] }`. The `{ fields: [...] }` object form still
  works and remains the extension slot.

### Removed

- **BREAKING** `@pro-laico/payload-revalidate` — internal shapes are no longer exported from the
  package root: `createTags`, `readRevalidateMarker`, and the types `PayloadRevalidateMarker`,
  `ResolvedRevalidateOptions`, `CollectionSettings`. Build raw tags with `tagsFor(payload)`
  (prefix-safe) — though the `revalidateDoc`/`revalidateList`/`revalidateGlobal` busters are
  lane-aware and almost always the better tool. _Migration: replace `createTags(prefix)` with
  `tagsFor(payload)`; nothing else had a supported use._

### Changed

- **BREAKING** `@pro-laico/payload-images` — the default `pixelStep` is now a conventional width
  ladder (`[640, 750, 828, 1080, 1200, 1920, 2048, 3840]`, next/image's deviceSizes) instead of a
  dense 50px grid: a wide original now emits ~8 `srcset` URLs per read instead of ~82 (~8KB of
  string), and the stored-variant space per image shrinks accordingly. Freeform widths still snap
  to the 50px anti-DoS grid. Pass `pixelStep: 50` to restore the old dense behavior.
  _Migration: none required — old variant files remain valid; new reads simply request ladder widths._

- **BREAKING** `@pro-laico/payload-images` — replacing an image's bytes under the same filename
  (`overwriteExistingFiles`, the admin crop tool) now purges stale variants and busts caches:
  `filesize`/`width`/`height` participate in the variant identity, the cache key, and the `v=`
  version token in lockstep. _Migration: existing cache keys and version tokens change once on
  upgrade — variants regenerate on first request (or next prewarm) and CDN caches bust once._

- `@pro-laico/payload-images` — `generated-images` read access now requires an authenticated user
  AND defers to the source collection's read access (re-rooted through the `source` relationship),
  so a tenant-scoped or owner-only source policy protects the cached variant docs and bytes too —
  previously any logged-in user could read every variant. Override stays available via
  `generatedImagesOverrides.access.read`.

### Fixed

- `@pro-laico/payload-images` — full audit-findings pass (item-by-item record mirrored in the
  project-management findings): the fallback picker no longer serves cross-crop-family or
  hotspot-mismatched stand-ins (ratio-drift gate, persisted `windowed` render path, webp only for
  webp-capable clients, achievable-width floor for cropped sources, png-quality tie-break);
  transform cache misses no longer hold original Buffers while queued (read moved inside the Sharp
  gate) and same-key requests coalesce across the endpoint AND the prewarm job, staying coalesced
  through the deferred-persist window; the prewarm recorder no longer drops or double-counts
  observations under concurrent flushes; a save landing while a pending prewarm job is being picked
  up re-defers that job instead of stranding the new identity; `prewarm.formats` is validated
  against `transform.formats` (unservable entries warn at boot, explicit `[]` honored);
  `buildVariantUrl` accepts numeric ids and never emits `h=0`; `imagesOverrides`/
  `generatedImagesOverrides` can no longer desync internals via `slug`; `extendCollection` throws a
  plugin-attributed error on field-name collisions; `imageFor()` resolves `null` instead of
  rejecting when the plugin isn't registered; the SSRF guard catches IPv4 addresses smuggled in
  IPv6 literals (`::ffff:169.254.169.254` and hex/compat forms); `readPluginMarker`, the marker
  types, and both collection slugs are now exported.

### Added

- `@pro-laico/payload-images` — per-image variant cap + guaranteed presets, closing the public
  endpoint's unbounded-storage vector. Each image has a `variantLimit` (default 200, project
  default via `imagesPlugin({ variantLimit })`): past the cap a new freeform size is served from
  a nearby existing variant, or generated correctly but not stored, so a public URL can't
  accumulate unbounded files/rows. **Presets** are the exemption — named, cap-exempt variants
  (`imagesPlugin({ presetTemplates })`, a default `og` 1200×630 ships) that editors toggle onto
  images by name (or add custom ones) in a new admin panel, seed as plain data, and serve via
  `/api/img/:id?preset=<name>` (or `getImageUrl(doc, { preset: 'og' })`). Presets honor exact
  dimensions (no snap grid) and are eagerly pre-generated on upload / file / focal change, so a
  cold social crawler never races generation. New `./admin/presetManager` export.

- `@pro-laico/payload-images` — nearby-quality fallback (default on): a transform cache miss
  with a same-geometry variant already generated (same fit + aspect ratio — identical crop —
  any quality/width/format) serves those bytes instantly instead of blocking on Sharp, while
  the exact variant generates in the background. The stand-in is served with
  `Cache-Control: no-store` (browser and CDN alike never cache it, and it is never persisted
  under the exact key), so the accurate image takes over on the very next request. Disable
  with `transform: { fallback: false }`. Pairs with prewarming: prewarm makes misses rare,
  the fallback makes the residual ones instant.

- `@pro-laico/payload-images` — smart prewarming (`prewarm: true | {...}`, default off): the
  transform endpoint learns which renders the site actually serves (browser-chosen widths,
  real fit/quality/format — recorded off the serving path into a hidden
  `image-render-profiles` collection, buffered and throttled), and new / file-replaced /
  re-focused images get exactly those variants pre-generated by a deferred, idempotent
  `imagesPrewarm` Payload Job — budgeted (`maxVariantsPerImage`, top observed widths per
  profile), deduped by cache key against organic traffic, enqueued 30s out so purges land
  first. Running jobs stays the app's business (plus an opt-in `autoRun` cron and a
  `payload images:prewarm` CLI with `--now` for runner-less bulk warms). Config `seeds` cover
  cold start; a broken jobs setup never blocks an upload.

- `@pro-laico/payload-images` — `createImageFor`, a Sanity-style fetch helper: seed it once
  with your app's Payload handle (`createImageFor(getPayload({ config }))` — the promise is
  fine as-is), then `imageFor(id).aspectRatio('16:9').blur('md').fetch()` runs the declared
  read for you and resolves the render-ready doc (`{ id, alt, src, srcset, placeholder }`),
  ready to spread into `<ResponsiveImage>`. A whole render can seed the chain in one go
  (`imageFor(id, { image, blur })`), and chains are immutable, so partially-applied ones can
  be shared and branched.

### Changed

- **BREAKING** `@pro-laico/payload-images` — the public surface is cut roughly in half so the
  package is easier to hold in your head. What examples and docs actually teach is untouched
  (`imagesPlugin`, `createImageFor`, `RESPONSIVE_IMAGE_SELECT`, `<ResponsiveImage>`,
  `getImageUrl`, `buildSrcset`); everything else was internals leaking out:

  - `transform` config loses its duplicate/dead knobs. `transform.presetTemplates` was silently
    ignored (the top-level option always won — a misconfig trap, now impossible),
    `transform.variantLimit` duplicated the top-level option, `transform.sourceSlug` was a
    confusing near-alias of `extendCollection`, and `transform.variantSlug` renamed an internal
    cache collection nobody needs to rename. Use the top-level `variantLimit` / `presetTemplates`
    / `extendCollection`; the cache collection is always `generated-images`.
  - An **array `pixelStep`'s widths now pass the endpoint's snap exactly** (the snap considers
    the ladder alongside the 50px grid — the variant space stays finite). The "keep ladder widths
    on multiples of 50" caveat and the `transform.dimensionStep` escape hatch are gone; a numeric
    `pixelStep` still sets the grid directly.
  - `focalUI` absorbs `previewRatios`: `focalUI: { previewRatios: [...] }` replaces the
    top-level option.
  - `buildSrcset` now takes an id **or a populated doc** (like `getImageUrl`) and derives the
    width cap + cache-busting `v` token itself — `buildSrcset(doc, { aspectRatio: '16:9' })` is
    the whole call (returns `null` for an empty resource). The `sourceWidth` option is gone, and
    the lower-level pieces it made you thread (`buildVariantUrl`, `deriveVersion`, `stepWidths`,
    `DEFAULT_TRANSFORM_API_PATH`, `VersionSource`) leave `/utils/urls`.
  - The main entry stops exporting placeholder/preset internals nobody consumed:
    `coverCropWindow`, `cropBlurhashCoefficients`, `blurhashToPngDataUri`, `BLURHASH_QUALITIES`,
    `WEBP_QUALITIES`, `DEFAULT_BLURHASH_QUALITY`, `DEFAULT_PRESET_TEMPLATES`,
    `DEFAULT_VARIANT_LIMIT`, `IMAGE_RENDER_PROFILES_SLUG`, and the types `CropWindow`,
    `BlurhashRequest`, `BlurhashQuality`, `WebpQuality`, `PrewarmReason`, `ImageGetter`,
    `PresetTemplate` (use `PresetSpec` — it was an alias). The virtual `placeholder` field
    already serves every declared render, so hand-rolling with these was never needed.
    `PREWARM_TASK_SLUG` stays (for queueing the job yourself), as do `PlaceholderQuality` /
    `PlaceholderFormat` / `ImagePalette` / `PaletteSwatch` (the render contract + stored palette
    types). `ResponsiveImage` is a named export only (the default export is gone).

### Fixed

- `@pro-laico/payload-images` — a read that declared an **empty** render (`context: { image: {} }`,
  or a natural-ratio render with no `blur`) got the raw `sm` blurhash as its `placeholder`
  instead of a finished data URI; `<ResponsiveImage>` then painted the hash as a CSS `url()`,
  firing a garbage request per image (`GET /LJJtSD~p…` → 404). Any declared render now always
  answers with a paintable data URI (the raw hash stays for truly undeclared reads and
  `blur: { format: 'hash' }`), and `<ResponsiveImage>` refuses to paint a non-URI placeholder.

- `@pro-laico/payload-images` — the admin Presets panel read the `presets` array through
  `useField(path)`, whose value on a loaded doc is the row *count*, not the rows: saved presets
  were invisible after reload (impossible to remove, easy to double-add). The panel now reads
  and mutates rows through the form's rows API (`useAllFormFields` + `addFieldRow` /
  `removeFieldRow`), so the add → save → reload → remove loop round-trips.

- All packages — every editor-facing collection (Images, Icons, Icon sets, Fonts, Mux videos) and
  the internal asset caches (`generated-images`, `image-render-profiles`, optimized/original fonts,
  icon-request telemetry) now set `admin.enableListViewSelectAPI: true`, so the list view queries
  only the columns it renders instead of whole documents — a real win on the large variant-cache
  tables. Custom thumbnail cells that read non-column fields keep working via `forceSelect`
  (`@pro-laico/payload-mux` force-selects `playbackOptions`; upload thumbnails are handled by
  Payload automatically).

- **BREAKING** `@pro-laico/payload-images` — the virtual `croppedBlurHash` field is now
  `placeholder` (the old name matched neither what it returns — a finished data URI for
  declared renders — nor the `<ResponsiveImage>` prop it feeds; the read-contract doc now
  spreads straight into the component). The field is virtual, so nothing is stored under the
  old name: update selects (`RESPONSIVE_IMAGE_SELECT` already carries the new name) and any
  code reading `doc.croppedBlurHash`, then regenerate your payload types.

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
