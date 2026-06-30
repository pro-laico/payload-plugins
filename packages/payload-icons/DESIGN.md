# @pro-laico/payload-icons — design

A deliberately small SVG-icons plugin for Payload CMS: one upload collection that turns messy,
designer-exported SVGs into clean, safe, themeable icons, plus a trivial way to render them on the
frontend and to seed them.

It is a **ground-up minimal rebuild** inspired by the SVG-optimization core of an earlier, much
larger internal icons package. Everything that tied that package to a specific design system —
icon sets, request/usage tracking, a static-scan CLs, block components, cache-tag plumbing, and a
hard dependency on the surrounding framework — is intentionally **left out**. What remains is the
part that is universally useful: take an SVG, make it good, store it, render it.

## Goals

1. **One job, done well.** Optimize + sanitize SVGs on upload; store an inline-ready string. No
   icon-set/versioning/usage concepts.
2. **Zero required configuration.** `iconsPlugin()` with no args registers a working `icon`
   collection. Options only override defaults.
3. **Framework-agnostic.** No `next`, no `server-only`, no design-system dependency. The frontend
   `<Icon>` is a pure component that renders a string; data fetching is a separate one-liner.
4. **Safe by construction.** The stored `svgString` is inlined via `dangerouslySetInnerHTML`, so
   the upload hook strips scripts / event handlers / `javascript:` URLs before anything is stored —
   even when geometry optimization is skipped.
5. **Easy seeding.** Reuse `@pro-laico/payload-seed`'s native media path rather than inventing a
   mechanism. Icons seed like any other upload.

## Shape

```
src/
  plugin.ts              iconsPlugin(options) → (config) => config
  collections/Icon.ts    the `icon` upload collection factory (+ ICON_SLUG)
  hooks/formatSVG.ts     svgo + viewBox tightening + sanitization (beforeChange)
  components/Icon.tsx    drop-in <Icon name> server component (exported via ./components/Icon)
  lib/
    extractSVG.ts        parse <svg> attrs / inner content (for inlining svgString)
    getIcon.ts           fetch a stored icon by name (server-side)
    derive.ts            iconNameFromFilename (behind the virtual `name` field)
    defaultAccess.ts     public read, admin writes
    mergeHooks.ts        append user hooks after the built-ins
  seed.ts                iconAssets() → defineAssets spec map
  types.ts               IconsPluginOptions, IconAccess, IconDoc
```

## Key decisions

### The collection is a standard upload collection

This is the decision that keeps the package small. Because `icon` is a normal Payload upload
collection (`upload.mimeTypes = ['image/svg+xml']`), three things come for free:

- **Seeding** works through `@pro-laico/payload-seed`'s existing media path — an SVG is uploaded
  via `payload.create({ file })`, which runs `formatSVGHook` just like an admin upload would. We
  add only `iconAssets()`, a helper that builds the `defineAssets` spec map pre-targeted at the
  `icon` collection. (Contrast `@pro-laico/payload-mux`, which needs a real *asset provider* seam
  because `mux-video` is **not** an upload collection — it ingests to an external service via a
  `source` field. Icons need none of that.)
- **The admin uploader, list view, and file storage** are Payload's, not ours.
- **Identity** is the filename. `getIcon(payload, 'arrow-right')` matches `arrow-right` or
  `arrow-right.svg`. No extra `name` field, no slugging — less to keep in sync.

### Optimization runs in a `beforeChange` hook, with svgo loaded dynamically

`formatSVGHook` only does work when an SVG file is actually present on the request, and it
`import()`s `svgo` / `svg-path-bbox` lazily so neither is ever pulled into a frontend or edge
bundle. svgo strips presentation attributes, then re-adds `fill="currentColor"` /
`stroke="currentColor"` so icons theme from CSS `color`. The `viewBox` is recomputed from real
path bounds and squared around the glyph center, so inconsistent source artboards still line up.

On any failure the hook returns the doc untouched — a bad SVG is stored raw rather than rejected,
but it is **always** sanitized first.

### `name` is a virtual field, not something callers rebuild

The icon's name (filename without `.svg`) is exposed as a **virtual field** (`afterRead`, pure —
no I/O), so it appears automatically in REST / GraphQL / the Local API and through relationship
population, instead of every consumer stripping the extension. A `forceSelect` on `filename` keeps
its input selected even under a consumer's `select`. Deliberately kept to this one derivation: a
`dataUri` virtual and a `defaultPopulate` trim were considered and dropped as over-reach for a
plugin whose value is inline, `currentColor`-themed SVG (a data URI can't theme; `defaultPopulate`
only helps if you relate to icons rather than reference them by name).

### A drop-in `<Icon name>` server component — the one frontend import

The plugin ships an async server component (`./components/Icon`) that fetches an icon by `name` and
inlines it, so the common case is genuinely zero-wiring: `<Icon name="arrow-right" className="…" />`,
one import, no wrapper file. The hard part — a published component getting a `payload` instance
without importing the host's `@payload-config` — is solved by resolving config through the
**`@payload-config` bundler alias** that `withPayload` configures (the standard Next + Payload
setup). The component does `await import('@payload-config' as string)`: the `as string` stops *this*
package's typecheck from resolving the specifier, while swc emits the literal so the host bundler's
alias still applies. A `config` prop is the escape hatch for non-aliased setups.

The cost is owning a React component + the `react` peer dep. We tried the leaner alternative (ship
no component, just `getIcon` + `extractSvg*` helpers and let the app write a tiny wrapper) and
reversed it: the wrapper-per-app friction wasn't worth the saved dependency when the alias makes a
true drop-in possible. The helpers stay exported for the cases the component can't serve — client
components, many-icons-in-one-query, and pre-fetched/populated `svgString` (the component itself is
just `getIcon` + `extractSvg*` composed, and also accepts a `svg` string to skip the lookup).

## Deliberately out of scope

Icon sets / grouping, draft-versioned icons, runtime usage / miss tracking, a source-scan CLI,
rich-text block components, and any cache-tag revalidation. A consuming app that wants cache
invalidation can attach its own `afterChange`/`afterDelete` hooks via the `hooks` option.
