# @pro-laico/payload-fonts

Custom fonts for [Payload CMS](https://payloadcms.com/). Adds a **Font** typeface collection
that takes uploaded font files, **subsets them to served WOFF2s**, an optional `fontSet` global
for picking the active sans / serif / mono / display faces, and an **export endpoint + CLI**
that writes the active fonts to disk for [`next/font/local`](https://nextjs.org/docs/app/api-reference/components/font).
Fonts can be created in the admin, server-side from a file (`ingestFont`), or **seeded
declaratively** via [`@pro-laico/payload-seed`](../payload-seed).

> **Ported from [`@pro-laico/fonts`](https://github.com/pro-laico/atomic-payload/tree/main/packages/fonts)
> (Atomic Payload, MIT).** Restructured to this monorepo's conventions and decoupled from the
> Atomic kernel (`@pro-laico/core`) and the `@pro-laico/styles` design set, with declarative
> seeding added.

```bash
pnpm add @pro-laico/payload-fonts
```

## Setup

```ts
import { buildConfig } from 'payload'
import { fontsPlugin } from '@pro-laico/payload-fonts'

export default buildConfig({
  plugins: [fontsPlugin()],
})
```

That registers three collections: `font` (the visible typeface) plus the hidden `fontOriginal`
(raw uploads) and `fontOptimized` (served WOFF2s). It also adds the `fontSet` global and the
`GET /api/fonts/export` endpoint. Editors create a **Font**, drop in either a variable file or
per-weight files, and the save hook subsets each to a served WOFF2.

### Next.js: externalize the subsetter

The subset step uses `subset-font` (harfbuzz **wasm**) and `fontkit`, which load wasm/native
assets at runtime by a path relative to their own module. If Next bundles them, that path is
rewritten to a virtual one that doesn't exist on disk and **the subset silently fails** (you'll
see `hb-subset.wasm ENOENT` in the server logs and no `fontOptimized` files). Mark them external:

```js
// next.config.mjs
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig = {
  serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit'],
}

export default withPayload(nextConfig)
```

If you skip this, the plugin logs one loud, actionable error the first time a subset fails, so a
broken setup is obvious rather than silent.

## How it works

```
font (typeface)              fontOriginal (hidden)        fontOptimized (hidden)
  title: "Inter"               raw uploaded bytes           subsetted WOFF2, served
  family: sans          ──▶    (woff/woff2/ttf/otf)   ──▶   weight/style/isVariable
  variable | weights[]         one per typeface slot        one per weight, linked back
```

- **`font`**: one document per typeface. Not an upload collection itself; it holds Payload
  `upload` slots (a `variable` group _or_ a `weights` array) pointing at `fontOriginal`. On save,
  every referenced original is subsetted to a `fontOptimized` WOFF2 (variable fonts keep their
  `wght` axis range; static files take the row's weight/style). Delete cascades to both.
- **`fontOriginal`**: the untouched archive. Carries no hooks, so it can be a client-upload
  (direct-to-Blob) collection in production. Each original belongs to exactly one typeface.
- **`fontOptimized`**: the bytes the site serves. Derived, never hand-uploaded; public-read so
  the build-time export can fetch them.

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Set `false` to skip the plugin entirely. |
| `charset` | `'latin' \| 'latin-ext' \| string` | `'latin'` | Characters the subsetter keeps (a preset, or an explicit string). |
| `includeFontSet` | `boolean` | `true` | Register the `fontSet` global (the active selection the export endpoint reads). Set `false` only if you drive the selection some other way. |
| `fontOverrides` | `Partial<CollectionConfig>` | — | Merged onto the `font` collection (e.g. tighter `access`). |
| `fontOriginalOverrides` | `Partial<CollectionConfig>` | — | Merged onto `fontOriginal` (e.g. `upload: { staticDir }` or a client-uploads adapter). |
| `fontOptimizedOverrides` | `Partial<CollectionConfig>` | — | Merged onto `fontOptimized` (e.g. `upload: { staticDir }`). |
| `fontSetOverrides` | `Partial<GlobalConfig>` | — | Merged onto the `fontSet` global. |

Overrides merge non-destructively: `fields` append, `access`/`admin`/`upload` shallow-merge,
`hooks` merge per phase, so `fontOriginalOverrides: { upload: { staticDir } }` keeps the built-in
font-mime whitelist.

## Creating a font from a file (server-side ingest)

Besides the admin slots, a typeface can be created **server-side** from a local file or URL,
which is handy for imports, migrations, and seeding. The `font` collection's `beforeValidate` hook
uploads the `source` to `fontOriginal`, wires the slot, and strips it:

```ts
import { ingestFont } from '@pro-laico/payload-fonts'

await ingestFont(payload, { source: '/path/to/Inter.woff2', title: 'Inter', family: 'sans', weight: '400' })
// variable font: ingestFont(payload, { source: '/path/to/Inter-Variable.woff2', title: 'Inter', family: 'sans', variable: true })
```

### Seeding with `@pro-laico/payload-seed`

`fontOriginal` is a plain Payload upload collection, so its raw font files seed **natively** like any
image — no asset marker, no glue. Each `font` typeface then **references** its original with
`ref('fontOriginal', <key>)` in a weights row, and the collection's `afterChange` hook subsets the
referenced original into a served `fontOptimized` WOFF2. Point the seed engine at both definitions and
map `fontOriginal`'s source folder with `assetSubDirs`:

```ts
import { fontsPlugin } from '@pro-laico/payload-fonts'
import { seedPlugin } from '@pro-laico/payload-seed'

plugins: [
  fontsPlugin(),
  seedPlugin({
    definitions: [fontOriginals, fonts, fontSet],
    assetSubDirs: { fontOriginal: 'font' }, // font files live in <assetsDir>/font/, not /fontOriginal/
  }),
]
```

```ts
// seed/fontOriginals.ts: raw font files, seeded natively like any upload (files live in <assetsDir>/font/)
import { defineSeed } from '@pro-laico/payload-seed'

export const fontOriginals = defineSeed('fontOriginal', ({ file }) => [
  { _key: 'inter', _file: file('inter.woff2') },
])
```

```ts
// seed/fonts.ts: each typeface refs its original in a weights row
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('font', ({ ref }) => [
  { _key: 'inter', title: 'Inter', family: 'sans', weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'inter') }] },
])
```

```ts
// seed/fontSet.ts: pick the active typeface per family
import { defineSeed } from '@pro-laico/payload-seed'

export const fontSet = defineSeed('fontSet', ({ ref }) => ({
  sans: ref('font', 'inter'),
}))
```

Nothing font-specific touches the seed engine: `fontOriginal` seeds like any upload, the typefaces ref
those originals, and the subset runs in this plugin's `afterChange` hook. The two packages stay decoupled.

## Serving the fonts on your frontend

The active fonts are applied as the `--font-set{Sans,Serif,Mono,Display}` CSS variables, so your
app just uses `font-family: var(--font-setSans)`. Those variables are produced **two ways that
never both fire**: optimized in production, zero-config in development. Wire both in your root
layout; each is a no-op in the other environment:

```tsx
import config from '@payload-config'
import definitionFonts from '@/app/definition'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'

<html className={extractFonts(definitionFonts)}>   {/* production: next/font */}
  <head>
    <DevFonts config={config} definition={definitionFonts} />   {/* development: runtime */}
  </head>
</html>
```

### Production — `next/font/local`

A build step fetches the active fonts and self-hosts them via
[`next/font/local`](https://nextjs.org/docs/app/api-reference/components/font), giving precise
preloading, size-adjusted fallbacks, and content-hashed static assets:

```jsonc
// package.json: set FONT_DOWNLOAD_URL (the running Payload URL) + PAYLOAD_SECRET
{ "scripts": { "prebuild": "payload-fonts-download" } }
```

`payload-fonts-download` writes `public/fonts/*.woff2` and `src/app/definition.ts`; `extractFonts`
puts the generated classes (which define the `--font-set*` variables) on `<html>`. Commit an empty
`definition.ts` (or add a `predev: payload-fonts-download`, which writes an empty stub when no
server is reachable) so the import resolves before the first build. Any error during the download
resets `definition.ts` to empty, so a failed/offline build never breaks on a stale font import.

### Development — `<DevFonts />`

`<DevFonts />` reads the active selection from Payload and inlines the matching `@font-face` +
`--font-set*` variables **at runtime**, so seeding or editing a font shows up on refresh with no
build step. It renders `null` in production, and stands down in dev once `definition.ts` is
populated, so running `payload-fonts-download` against your dev server lets you preview the exact
production path locally. (It's a server component; pass it your `@payload-config`.)

Tune the output paths and the CSS-variable prefix with `PAYLOAD_FONTS_*` env vars (see
`runDownloadFonts`). If you change `cssVariablePrefix`, pass the same `cssVarPrefix` to `DevFonts`.

## License

MIT
