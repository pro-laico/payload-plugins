# Changelog

All notable changes to this monorepo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). All `@pro-laico/*`
packages share one lockstep version.

## [Unreleased]

Every plugin's options now have the same nested shape, and the toggles that never earned their keep
are gone. Configure one plugin and you can guess the next: `enabled`, a `collections` entry per
collection the plugin registers (and `globals` where it has any), the one or two items that *are*
the plugin, then `options` for everything else. Every collection entry reads the same way too —
`slug` to rename, `overrides` for Payload passthrough, `options` for the plugin's own knobs. Four
options were deleted outright — each one's "off" state was already unreachable or incoherent — and
two defaults flip on. Breaking for all seven packages. See **Upgrade notes**.

### Highlights

#### One options shape across all seven plugins

The root of every plugin separates what it *registers* from how it *behaves*: `collections` /
`globals` describe the collections, and a single `options` object holds the plugin's own knobs. The
one or two things that *are* the plugin stay at the root beside `options` (`payload-seed` keeps
`definitions` there). No more flat sprawl of domain options, and no more `admin` block — admin-only
toggles belong to the collection they configure, so they moved onto it.

Every `collections.<name>` (and `globals.<name>`) entry is the same three-part shape:

```ts
imagesPlugin({
  collections: {
    images: {
      slug: 'media',                          // rename it
      overrides: { access: { read } },        // Payload passthrough — anything CollectionConfig has
      options: { folders: true, focalUI },    // this plugin's own knobs for THIS collection
    },
  },
  options: { prewarm: {}, transform: {} },    // the plugin's own behavior
})
```

`overrides` and `options` never bleed together: one is Payload's vocabulary, the other is the
plugin's — and `overrides` excludes `slug` at the type level, so a rename can only go through the
top-level `slug` key the plugin actually threads. A collection the plugin can work without also takes `false` to opt out — retiring the old
boolean-plus-overrides pairs (`includeIconSet` + `iconSetOverrides`, `trackRequests` +
`iconRequestOverrides`), each of which could express an unreachable state. Optional sub-features
read `false | Options` everywhere — the `boolean | Options` form is gone, since `true` never meant
anything `{}` didn't. `payload-revalidate` is the exception that proves the rule: it *annotates*
your collections rather than registering its own, so its `collections` is keyed by your slugs with
no `slug`/`overrides` — just the tracking config, and `false` to opt one out.

Every package resolves its defaults in one place — a `resolveOptions` in `src/options.ts` returning
a mirror type (same keys, same nesting) — so "what's the default for X" is answerable from one file.
Every package also exports a typed `read<Name>Marker(config)` for its `config.custom.payload<Name>`
stash. The uniform `CollectionOption` / `GlobalOption` shape is a shared type, so the structure is
enforced by the compiler, not by convention.

#### One merge contract, and renaming is now first-class

The shape was uniform after the pass above, but what an override *did* still wasn't. Three plugins
carried near-copies of the merge algorithm and one carried a bespoke allowlist, and they had
drifted: `payload-icons` couldn't override `labels` or `versions` at all, and `payload-fonts`' copy
was missing the slug guard — which meant `fontsPlugin({ collections: { font: { slug: 'typefaces' } } })`
type-checked and then died at boot with `Field Font has invalid relationship 'font'`.

There is now one algorithm, in one place, vendored into each package that registers collections:
`slug` renames, `fields` append (a duplicate name is a boot error naming the plugin, the collection,
and the field), `hooks` merge per phase, `access` / `admin` / `upload` / `custom` shallow-merge,
`defaultPopulate` / `forceSelect` merge as selects, everything else replaces. Every override is a
plain `Partial<CollectionConfig>` — whatever Payload's config has, you can override. CI fails if a
package's copy drifts from the source.

`slug` is now a supported override rather than a forbidden one, and each plugin follows the rename
through every reference it owns — relationship and join fields, hooks, endpoints, and the slug it
publishes on its marker. That's what replaces `extendCollection`.

The same vendoring now carries the helpers every plugin had its own copy of: `isRecord` (seven
byte-identical copies), `binScriptPath` (four), and the `authd` / `anyone` access primitives (three).
`binScriptPath` is the one that mattered — it encodes which extension a `config.bin` entry points at,
`.ts` in a workspace and `.js` in a published install, and getting that wrong doesn't fail a build:
the command is simply missing when you run it. A conformance test now asserts every registered bin
resolves to a file that exists.

#### Defaults that stop hiding the feature you installed

`payload-seed`'s button is now always registered. It was already double-guarded — the button
renders nothing and the endpoint 403s unless `ENABLE_SEED=true` — so `adminButton: false` only
meant you could opt into seeding and still get no button. `ENABLE_SEED` is the switch.

`payload-images` turns folders on: the plugin's premise is a managed image library, and a library
without organization is the wrong default. It localizes `alt` when your app configures
localization, because a localized site localizes its alt text — that's an accessibility fact, not
a preference.

#### Toggles removed

`payload-images`' `transform: false` cost 17 conditional branches across the plugin and its
collection layer to support a mode that left you a transform plugin with no transform endpoint —
an upload collection plus a variant cache that never fills. The endpoint is the plugin, so it's
always registered, and `virtualFields` goes with it: it was already derived from `transform`, and
its only remaining state contradicted the plugin's own exported read contract.

`payload-revalidate`'s `endpoint` was a third gate on endpoints that already 404'd when `observe`
was off and still require an authenticated user in production. `observe` alone governs them now —
and with `observe: false` they aren't registered at all, which is stronger than the old 404.

### Changed

- **BREAKING** `@pro-laico/payload-fonts` — one uniform serving path, and `<DevFonts>` is replaced by
  `<PreviewFonts>`. Fonts are now baked everywhere: run `payload fonts:download` (Local API, no
  running site) to write `public/fonts/*.woff2` + the `next/font/local` module, then `extractFonts`
  on `<html>` — in dev and prod alike (wire it on `predev` / `prebuild`, as `service-co` does). The
  old dev-only `<DevFonts>` (which served live in dev and stood down once the definition was baked)
  is gone; in its place `<PreviewFonts>` from `@pro-laico/payload-fonts/PreviewFonts` inlines the live
  `@font-face` selection and works in **any** environment — dev or production — for the isolated case
  where you're previewing a font (a preview route, a font playground; `fonts-sandbox` demonstrates
  it). Render it inside `<Suspense>`, not behind `export const dynamic = 'force-dynamic'`. Its props
  drop `definition` (it never stands down). The two paths are no longer "dev vs prod" — baked is the
  main way, `<PreviewFonts>` is a deliberate escape hatch.
- **BREAKING** `@pro-laico/payload-icons` — `iconOverrides` → `collections.icon.overrides`;
  `iconSetOverrides` → `collections.iconSet.overrides`; `iconRequestOverrides` →
  `collections.iconRequest.overrides`; `includeIconSet: false` → `collections.iconSet: false`;
  `trackRequests: false` → `collections.iconRequest: false`; `usagePanel` →
  `collections.iconSet.options.usagePanel`; `iconRowFields` → `collections.iconSet.options.iconRowFields`.
- **BREAKING** `@pro-laico/payload-fonts` — `fontOverrides` → `collections.font.overrides`;
  `fontOriginalOverrides` → `collections.fontOriginal.overrides`; `fontOptimizedOverrides` →
  `collections.fontOptimized.overrides`; `fontSetOverrides` → `globals.fontSet.overrides`;
  `includeFontSet: false` → `globals.fontSet: false`; `charset` / `families` → `options.charset` /
  `options.families`.
- **BREAKING** `@pro-laico/payload-images` — `imagesOverrides` → `collections.images.overrides`;
  `generatedImagesOverrides` → `collections.generatedImages.overrides`; `focalUI` →
  `collections.images.options.focalUI` (bare `true` form gone — pass `{}` or omit); `folders` →
  `collections.images.options.folders`; `localizeAlt` / `mimeTypes` / `maxOriginalSize` →
  `collections.images.options.*`; `transform` / `prewarm` / `pixelStep` / `presetTemplates` /
  `variantLimit` → `options.*`; `prewarm: true` → `prewarm: {}`.
- **BREAKING** `@pro-laico/payload-mux` — `adminThumbnail` → `collections.muxVideo.options.thumbnail`;
  `initSettings` / `uploadSettings` / `signedUrlOptions` / `playbackPolicy` / `posterExtension` /
  `animatedGifExtension` / `autoCreateOnWebhook` / `access` → `options.*`. The `MuxVideo` collection
  factory is no longer exported; `collections.muxVideo.overrides` covers it. Defaults that were
  implicit fallthroughs are now explicit: `playbackPolicy: 'public'`, `posterExtension: 'png'`,
  `animatedGifExtension: 'gif'`, and the thumbnail cell `'gif'`.
- **BREAKING** all seven — `collections.<name>` / `globals.<name>` is now a three-part entry
  (`slug`, `overrides`, `options`), not a bare `Partial<CollectionConfig>`. Renaming stays
  `collections: { images: { slug: 'media' } }`; your Payload keys move under `overrides`
  (`collections: { images: { overrides: { fields: [...] } } }`); a plugin's own per-collection knobs
  live under `options`. `payload-revalidate` is the exception — it annotates your collections rather
  than registering its own, so its `collections.<yourSlug>` is the tracking config directly, with
  no `slug` / `overrides`.
- **BREAKING** `@pro-laico/payload-icons` — collection overrides are a plain `Partial<CollectionConfig>`
  (under `overrides`) instead of a per-collection allowlist, so keys the allowlist silently dropped
  now apply: `labels`, `versions`, `defaultPopulate`, `forceSelect`, `defaultSort`, `timestamps`,
  `endpoints`, `custom`, every `admin.*` beyond `group`, and `access` on `iconSet` / `iconRequest`
  (which had no access key at all). Three bespoke keys fold into what Payload already has: `adminGroup`
  / `group` → `overrides.admin.group`, `livePreviewUrl` → `overrides.admin.preview` +
  `overrides.admin.livePreview`, `drafts: boolean` → `overrides.versions`.
- **BREAKING** `@pro-laico/payload-icons` — fields passed to `collections.iconSet.overrides.fields`
  now land at the collection's top level, below the tabs, rather than inside the Settings tab. Fields
  append at the collection level in every plugin now; the old builder spliced them into that tab. Only
  the admin layout moves — the data is unchanged. Put a field back inside a tab by overriding the tabs
  field itself.
- **BREAKING** `@pro-laico/payload-mux` — `access` is now two gates, one axis each, under `options`:
  `access: (req) => …` → `options: { access: { read: (req) => …, upload: (req) => … } }`. One function
  used to gate both collection reads and the direct-upload endpoints, so "let the public read videos
  but keep uploads admin-only" was not expressible. Both still default to a logged-in admin-collection
  user.
- **BREAKING** `@pro-laico/payload-seed` — gains `enabled` (default `true`), matching every other
  plugin; `assetsDir` / `assetSubDirs` move under `options`, `definitions` stays at the root.
- **BREAKING** `@pro-laico/payload-revalidate` — `prefix` / `rules` / `observe` move under `options`;
  `collections` / `globals` stay at the root.
- **BREAKING** `@pro-laico/payload-dev-tools` — `devRoute` moves under `options`.
- `@pro-laico/payload-dev-tools` — `enabled` now gates the config once instead of being re-checked
  per request by four endpoint handlers, so when it's off the dev endpoints don't exist at all
  rather than registering and 404ing. Same default (`NODE_ENV === 'development'`).
- `@pro-laico/payload-mux` — gains `collections.muxVideo`; it was the only plugin with no way to
  override its own collection.
- `@pro-laico/payload-images` — the `PayloadImagesMarker` type no longer lies: it declares the
  `options` the plugin has always stashed, and its slug/path fields are required rather than
  optional. `readPluginMarker` → `readImagesMarker`, and it returns `undefined` (not `{}`) when the
  plugin isn't registered.

### Added

- `@pro-laico/payload-icons` — `readIconsMarker`, and `@pro-laico/payload-fonts` — `readFontsMarker`.
  Both plugins already stashed a marker on `config.custom` and both defined the reader internally,
  but neither exported it, so the convention every other plugin follows — and that the docs describe
  as the way to discover a slug — was unavailable for these two. It matters more now that a slug can
  be renamed: the marker is the answer to "which slug did this plugin actually register?".

- `@pro-laico/payload-images` — `collections.renderProfiles`, so the render-profiles collection
  prewarming writes to can be renamed and reshaped like the other two. It's a table in your
  database; it gets a `collections` key like anything else. `prewarm` still owns whether it exists.

- `@pro-laico/payload-images` — **`aspectRatio` is declared once, on the read.** The fetched doc now
  carries the ratio it was cropped to (the read's, else the image's natural one), so spreading it
  into `<ResponsiveImage>` gives the CSS box for free. It used to have to be stated twice — once on
  the read so the crop is computed, once on the component so the box matches — with a silently
  wrong-shaped image if the two drifted. Pass `aspectRatio` to the component only to override.
  Populated upload fields get it too, since `defaultPopulate` is the same projection.
  `aspectRatio` is now genuinely ignored under `fill` (the positioned parent owns the box), which
  the props table always claimed but the component didn't do.
- `@pro-laico/payload-fonts` — **`payload fonts:download`**, a build step that needs no running
  site. It resolves the `fontSet` selection through the Local API and writes the same
  `public/fonts/*.woff2` + `next/font/local` module the HTTP CLI does — but with no
  `FONT_DOWNLOAD_URL`, no `PAYLOAD_SECRET` round-trip, and nothing to be up and publicly reachable
  while `prebuild` runs. Fonts on S3 still work: the read goes through the collection's own storage
  adapter. Point `prebuild` / `predev` at it and delete the two env vars.

  The HTTP `payload-fonts-download` CLI stays as the secondary path, for builds that genuinely can't
  reach the database (a remote build box that can hit the running site but not its DB). It still
  fails soft — every handled failure writes an empty definition and exits 0, deliberately: erroring
  would make the *first* production deploy impossible, since no server yet means no fonts selected,
  which would fail the build, which means you never get a server. When it can't reach a site it now
  points you at `payload fonts:download`, which reads the database directly and needs none.
- `@pro-laico/payload-mux` — `MuxAccessFn` / `MuxAccessOptions` are exported, so a shared `read` /
  `upload` gate can be typed.
- `@pro-laico/payload-mux` — env-name compatibility with `@oversightstudio/mux-video`. Where the
  two disagree, the Oversight name is now read as a fallback: `MUX_WEBHOOK_SIGNING_SECRET` for
  `MUX_WEBHOOK_SECRET`, `MUX_JWT_KEY_ID` for `MUX_SIGNING_KEY`, and `MUX_JWT_KEY` for
  `MUX_PRIVATE_KEY` (`MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` already matched). Switching plugins no
  longer means renaming anything in your host env, and a project that already had the Oversight
  names set no longer silently 401s every webhook. The Mux-SDK name wins when both are set, and an
  explicit `initSettings` field still beats every env var.
- All packages — a typed `read<Name>Marker(config)` export (`readImagesMarker`, `readIconsMarker`,
  `readFontsMarker`, `readMuxMarker`, `readSeedMarker`, `readRevalidateMarker`,
  `readDevToolsMarker`) plus the marker type, so nothing hand-casts `config.custom`.
- `@pro-laico/payload-seed` — `PayloadSeedMarker` (`{ options, endpointPath, assetsDir }`), the
  package's first typed marker.

### Removed

- **BREAKING** `@pro-laico/payload-fonts` — the `<DevFonts>` component and its
  `@pro-laico/payload-fonts/DevFonts` subpath export. Replaced by `<PreviewFonts>`
  (`@pro-laico/payload-fonts/PreviewFonts`) — see **Changed**.
- **BREAKING** `@pro-laico/payload-images` — `transform: false`. `transform` is now only a config
  object; the transform endpoint is always registered.
- **BREAKING** `@pro-laico/payload-images` — `virtualFields`. The virtual URL fields are always
  added, and `defaultPopulate` is always the lean `RESPONSIVE_IMAGE_SELECT`. `forceSelect` still
  carries the virtuals' inputs, so they survive an explicit `select`.
- **BREAKING** `@pro-laico/payload-seed` — `adminButton`. The button is always registered;
  `ENABLE_SEED=true` governs it, as it always did.
- **BREAKING** `@pro-laico/payload-revalidate` — `endpoint`. `observe` governs the map endpoints.
- **BREAKING** `@pro-laico/payload-images`, `@pro-laico/payload-mux` — `extendCollection`. Attaching a
  plugin's fields to a collection you declared yourself was a second way to say what renaming now
  says, and the confusing one: it inverted ownership, needed its own merge order, its own boot
  errors, and a set of "this option is ignored while extending" warnings. Rename the plugin's
  collection instead — it stays the plugin's, wired and working, and your overrides shape it:
  ```ts
  // before
  imagesPlugin({ extendCollection: 'media' })
  // after
  imagesPlugin({ collections: { images: { slug: 'media', fields: [/* yours */] } } })
  ```
  With it go `[payload-mux] extendCollection: collection '<slug>' not found` and the `access.read is
  ignored` warning — neither is reachable now.

### Fixed

- `@pro-laico/payload-fonts` — renaming the font collection no longer breaks the boot.
  `collections: { font: { slug: 'typefaces' } }` type-checked but then threw `Field Font has invalid
  relationship 'font'`, because the plugin hardcoded `'font'` when wiring the `fontOptimized ->
  font` relationship while its marker reported the real slug. Every internal reference now follows
  the resolved slug, and a test asserts the relationship lands on the renamed collection.
- `@pro-laico/payload-dev-tools` — the Mux panel now reports on a renamed Mux collection instead of
  showing it as absent. It read the slug from `options.extendCollection`, so it only ever saw a
  rename made through that option; it now reads `muxVideoSlug` off the marker, which is the slug the
  plugin actually registered.
- `@pro-laico/payload-fonts` — `PAYLOAD_FONTS_*` env vars set in `.env.local` / `.env` now actually
  apply. The download CLI read them out of `process.env` *before* it loaded the env file, so
  `PAYLOAD_FONTS_OUTPUT_DIR` and friends silently fell back to their defaults unless you exported
  them in the shell — while `FONT_DOWNLOAD_URL`, read after the load, worked fine. The env file is
  now loaded before anything else is read, which also gives `payload fonts:download` the same
  handling.
- `@pro-laico/payload-icons` — the IconSet **Requested icons** panel no longer reports
  "0 of 0 … All present ✅" while your manifest has the names. In dev the panel scans live, and that
  scanner swallows every fs error and returns an empty-but-truthy manifest — so a scan that couldn't
  see your code (a cwd that isn't the app root, roots outside `src` / `app`, an aliased `<Icon>` tag)
  silently shadowed the `icon-usage-manifest.json` the CLI wrote, and then printed a green checkmark
  over a scan that had checked nothing. The panel now prefers whichever source actually found names,
  and an empty scan says so plainly instead of passing: the checkmark is unreachable unless something
  was really checked. Copy also reads "3 of 3 requested icons are defined here" rather than
  "names requested in code".
- `@pro-laico/payload-mux` — extending a collection that already defines a field the plugin injects
  (`title`, `assetId`, `status`, `duration`, `playbackOptions`, …) now fails at boot with a
  plugin-attributed error naming the colliding fields, instead of Payload's bare
  `DuplicateFieldName` with no hint as to which plugin put the second field there.
- `@pro-laico/payload-revalidate` — **the finders no longer force `overrideAccess: false`.**
  `findDoc` / `findDocByID` / `findIds` / `findGlobal` now leave access to Payload's own default
  (`true`), matching what you'd get calling `payload.find` yourself. The old default read as an
  anonymous visitor — and since the finders also refuse `user` / `req`, there was no way to be
  anything else — so any collection with a restricted `read` silently came back `null` or empty in
  a getter, with no error to explain it. `@pro-laico/payload-mux`'s admin-only read default hit
  exactly this: cached video docs resolved to `null` and the player rendered nothing.
  Pass `overrideAccess: false` explicitly to keep the old anonymous-scoped behavior for a read.
  **Review any getter that reads an access-gated collection**: a finder that previously returned
  `null` may now return the doc, so a cached entry can hold data an anonymous visitor could not
  read — which is the intent, but it is a change in what lands in a shared cache entry.
- `@pro-laico/payload-mux` — a video whose `video.asset.ready` webhook never arrived is no longer
  stuck on `preparing` forever. Saving the doc now refetches the asset from Mux and lands it on
  `ready` (or `errored`), so a missed webhook — a wrong `MUX_WEBHOOK_SECRET`, an unreachable
  endpoint, Mux downtime — is recoverable from the admin instead of needing the event resent from
  the Mux dashboard or the video re-uploaded. Healing is best-effort: if Mux can't be reached the
  save still goes through and the doc is left as it was.
- `@pro-laico/payload-seed` — installing the plugin with `ENABLE_SEED=true` set gave you no admin
  button unless you also passed `adminButton: true`, which was easy to miss and impossible to
  discover from the admin UI.

### Docs

- **No more `export const dynamic = 'force-dynamic'`** — in the examples or the guidance. Every
  example app now renders live reads as dynamic holes inside `<Suspense>` with `cacheComponents` on
  (a static shell that streams the live parts), and the docs that used to reach for `force-dynamic`
  (payload-dev-tools, payload-fonts) now teach the Suspense pattern. `force-dynamic` opts a whole
  route out of prerendering; it read as the easy answer and set a poor example.
- **Framework requirements are now stated per plugin, and stated correctly.** The docs asserted
  globally that everything needs "Payload `^3`, React 19, and the Next.js App Router" — untrue for
  `payload-mux` and `payload-seed`, which have zero `next/` imports and no `next` peer at all.
  Conventions now carries a per-plugin table: required for `payload-revalidate` (16+),
  `payload-images`, and `payload-dev-tools`; needed only to *render* icons / *serve* fonts for
  `payload-icons` and `payload-fonts`; not needed for `payload-mux` / `payload-seed`.
  `payload-icons` had a Requirements section that never mentioned Next despite `<Icon>` reading
  `draftMode()`; `payload-images` and `payload-dev-tools` — the two with a required `next` peer —
  had no Requirements section at all. All 7 READMEs gained a `Requires` line up front; none had one.
- The shared **Conventions** page documents the options skeleton, the one-key-per-collection rule,
  the `false | Options` rule, and reading a plugin's marker back.
- Every plugin Reference reflects the new nested shape, and the `payload-images` pages drop the
  removed `transform: false` / `virtualFields` modes.
- `payload-mux` **Troubleshooting** leads the stuck-on-`preparing` row with the re-save recovery.
- `payload-images` **Rendering** gains the two examples every other one implied but never showed: a
  **card grid**, where `sizes` is the arithmetic people actually get wrong (describe the slot, not
  the file), and **art direction** — a real `<picture>` with `buildSrcset` giving a different *crop*
  per breakpoint (21:9 desktop → 4:5 phone), which `sizes` alone can't express. `buildSrcset` had
  been name-dropped as existing for "a fully hand-rolled `<img>` / `<picture>`" without ever being
  demonstrated.

### Upgrade notes

1. Run `pnpm install` (or your package manager's equivalent) to pull the new versions.
2. **Adopt the nested shape.** A collection's Payload overrides move under `overrides`, a plugin's
   own per-collection knobs under `options`, and the root domain options under a root `options`.
   Renaming stays a direct `slug` key. Mechanical, but touches every plugin you configure — the
   **Changed** section is the field-by-field map. The two `true` forms that are gone
   (`prewarm: true`, `focalUI: true`) become `{}`.
   ```ts
   // before
   imagesPlugin({ folders: false, prewarm: {}, collections: { images: { fields: [credit] } } })
   // after
   imagesPlugin({
     collections: { images: { options: { folders: false }, overrides: { fields: [credit] } } },
     options: { prewarm: {} },
   })
   ```
3. `@pro-laico/payload-images`: **folders now default on.** This adds a nullable `folder`
   relationship and Payload's hidden `payload-folders` collection — additive, so it needs a schema
   push (`pnpm payload migrate` or a dev push) but no data migration. It also registers Payload's
   folder admin components, so **run `pnpm payload generate:importmap`** and restart, or the admin
   fails to resolve them. Pass `collections: { images: { options: { folders: false } } }` to keep the
   old behavior.
4. `@pro-laico/payload-images`: **`localizeAlt` now defaults to `Boolean(config.localization)`.** If
   your app configures localization and your `alt` field is currently unlocalized, this flips
   `localized` on an existing field — a real data migration. Set
   `collections: { images: { options: { localizeAlt: false } } }` to keep the old behavior, or
   migrate deliberately.
5. `@pro-laico/payload-images`: if you passed `transform: false` or `virtualFields: false`, there is
   no replacement — those modes are gone. Drop the option.
6. `@pro-laico/payload-seed`: remove `adminButton`; set `ENABLE_SEED=true` where you want the button.
   Move `assetsDir` / `assetSubDirs` under `options`; leave `definitions` at the root.
7. `@pro-laico/payload-revalidate`: remove `endpoint`; use `observe` to govern the map endpoints.
   Move `prefix` / `rules` / `observe` under `options`; `collections` / `globals` stay at the root.
8. `@pro-laico/payload-mux`: if you imported `MuxVideo` directly, move those overrides to
   `collections: { muxVideo: { overrides: { … } } }`.
9. `@pro-laico/payload-mux`: split your `access` function in two, under `options`. The same function
   in both slots reproduces today's behavior exactly:
   ```ts
   // before
   muxVideoPlugin({ access: (req) => Boolean(req.user) })
   // after
   const gate = (req) => Boolean(req.user)
   muxVideoPlugin({ options: { access: { read: gate, upload: gate } } })
   ```
10. `@pro-laico/payload-images`, `@pro-laico/payload-mux`: **`extendCollection` is gone.** Rename the
    plugin's own collection instead, and move the fields you had on your collection into `overrides`:
    ```ts
    // before — your `media` collection, with the plugin's fields attached to it
    const media = { slug: 'media', labels: { singular: 'Medium', plural: 'Media' }, fields: [caption] }
    export default buildConfig({ collections: [media], plugins: [muxVideoPlugin({ extendCollection: 'media' })] })

    // after — the plugin's collection, renamed to `media` and shaped by you
    export default buildConfig({
      plugins: [
        muxVideoPlugin({
          collections: { muxVideo: { slug: 'media', overrides: { labels: { singular: 'Medium', plural: 'Media' }, fields: [caption] } } },
        }),
      ],
    })
    ```
    Two behavior changes to check. **Access**: the collection is now the plugin's, so its read gate
    defaults to a logged-in admin user, where your own collection's access previously stood. Set
    `collections.muxVideo.overrides.access.read` (or the plugin's `options.access.read`) to what your
    collection had. And the **table name follows the slug**, so if the slug you rename to is the one
    your collection already used, the data stays put; renaming to anything else is a table rename and
    needs a migration.
11. `@pro-laico/payload-icons`: overrides are now a plain `Partial<CollectionConfig>` (under
    `overrides`) rather than an allowlist, so keys that were silently dropped before — `labels`,
    `defaultPopulate`, `versions`, and the rest — now take effect. If you passed any of those and
    worked around them being ignored, remove the workaround. Rename the bespoke keys under
    `overrides`: `adminGroup` / `group` → `overrides.admin.group`, `livePreviewUrl` →
    `overrides.admin.preview` + `overrides.admin.livePreview`, `drafts: true` →
    `overrides.versions: { drafts: true }`. Move `usagePanel` / `iconRowFields` to
    `collections.iconSet.options`. And if you pass icon-set fields, **look at the edit view after
    upgrading** — they now render below the tabs instead of inside the Settings tab. Data is
    untouched; it's a layout change only.
12. `@pro-laico/payload-revalidate`: audit any cached getter that reads an access-gated collection.
    Finders no longer force `overrideAccess: false`, so a read that used to come back `null` may now
    return the doc. Pass `overrideAccess: false` on that call to keep the old anonymous scoping.
13. `@pro-laico/payload-fonts`: **`<DevFonts>` is gone — bake in dev too.** Point `predev` (and
    `prebuild`) at `payload fonts:download` so `definition.ts` is baked before the server starts, and
    keep `extractFonts(definition)` on `<html>`; that's the whole serving story now, dev and prod.
    Drop the `<DevFonts>` line from your root layout. If you want to preview an unbaked font change,
    render `<PreviewFonts payload={getPayload({ config })} />` (from `@pro-laico/payload-fonts/PreviewFonts`)
    inside a `<Suspense>` in that context — it drops the `definition` prop and works in any
    environment. Do not add `export const dynamic = 'force-dynamic'`; a `<Suspense>` boundary with
    `cacheComponents` is the right way to render a live read.
14. Beyond the images folders/localizeAlt notes above, and a slug rename if you replaced
    `extendCollection`, no data migration is required.

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
