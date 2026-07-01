# @pro-laico/payload-icons

SVG icons for [Payload CMS](https://payloadcms.com/). Adds an **Icon** upload collection that
**optimizes and sanitizes** every SVG on save — [svgo](https://github.com/svg/svgo) + a tightened,
squared `viewBox` + `currentColor` theming — and a **drop-in `<Icon name="…" />`** server component
that fetches and inlines the SVG with zero wiring. One-line declarative seeding via
[`@pro-laico/payload-seed`](../payload-seed).

```bash
pnpm add @pro-laico/payload-icons
```

## Setup

```ts
import { buildConfig } from 'payload'
import { iconsPlugin } from '@pro-laico/payload-icons'

export default buildConfig({
  plugins: [iconsPlugin()],
})
```

That registers an `icon` collection. Upload `.svg` files through the admin UI; each is optimized
on save. The collection stores:

- **`svgString`** — the cleaned, sanitized `<svg>…</svg>`, ready to inline.
- **`optimized`** — a human-readable report (e.g. `SVG optimized: 1234 to 567 bytes (54.1% reduction)`).

…and exposes a **virtual** `name` field (the filename without directory or `.svg`, e.g.
`arrow-right`), computed per read — see [Computed fields](#computed-fields).

### What the optimizer does

- **Sanitizes** untrusted SVGs: strips `<script>` elements, `on*` handlers, and `javascript:`
  URLs (the stored string is later inlined via `dangerouslySetInnerHTML`).
- **Optimizes** with svgo (`preset-default` + path/number cleanup, dimensions removed).
- **Themes** by replacing hard-coded `fill`/`stroke` with `currentColor`, so an icon takes its
  color from CSS.
- **Normalizes** the `viewBox`: tightened to the real path bounds and squared around the glyph's
  center, so mismatched source artboards render consistently.

SVGs using `transform`/`clip-path` skip the geometry rewrite (it can't be applied safely) but are
**still sanitized** before storage.

## Options

`iconsPlugin()` takes no arguments by default. Pass any of these to customize:

| Option | Type | Default | |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Set `false` to skip registering the collection. |
| `slug` | `string` | `'icon'` | Collection slug. |
| `adminGroup` | `string` | `'Assets'` | Admin sidebar group. |
| `access` | `{ read?, create?, update?, delete? }` | public read, admin writes | Override per-operation access. |
| `fields` | `Field[]` | — | Extra fields appended after the built-in fields. |
| `hooks` | `CollectionConfig['hooks']` | — | Extra hooks, appended after the built-ins. |
| `upload` | `CollectionConfig['upload']` | `{ mimeTypes: ['image/svg+xml'] }` | Shallow-merged upload config (e.g. a `staticDir`). |

```ts
iconsPlugin({
  adminGroup: 'Brand',
  fields: [{ name: 'category', type: 'select', options: ['ui', 'social', 'brand'] }],
})
```

> Read defaults to **public** — icons are frontend assets. Tighten it with `access.read` if yours
> are private.

## Use an icon on the frontend

One import, no wrapper file. The `<Icon>` server component fetches the icon by `name` and inlines it
as a real `<svg>` — your `className`/props win over the SVG's intrinsic attributes, and it inherits
CSS `color` via `currentColor`:

```tsx
import { Icon } from '@pro-laico/payload-icons/components/Icon'

<Icon name="arrow-right" className="size-6 text-primary" />
```

It's an async **server component** (it queries Payload), so use it in a server component / page. By
default it resolves your config via the `@payload-config` alias that `withPayload` sets up — the
standard Next + Payload setup, so there's nothing to wire. For a non-aliased setup, pass `config`
explicitly. Renders nothing if the name doesn't resolve.

### Rendering it yourself

For client components, many-at-once rendering, or a populated relationship you already fetched, skip
the component: `getIcon(payload, name)` returns the icon doc, and the pure `extractSvg*` helpers
inline its `svgString`. (The `<Icon>` component is just these two composed.)

```tsx
import { extractSvgContent, extractSvgProps, getIcon } from '@pro-laico/payload-icons'

const icon = await getIcon(payload, 'arrow-right')
if (!icon?.svgString) return null
return <svg {...extractSvgProps(icon.svgString)} className="size-6" dangerouslySetInnerHTML={{ __html: extractSvgContent(icon.svgString) }} />
```

You can also pass a string straight to the component — `<Icon svg={icon.svgString} />` — to render
without a lookup (e.g. a populated `page.icon`).

## Computed fields

`name` is a **virtual** field — never stored, derived per read with a pure `afterRead` hook (no
I/O) — so it appears in REST, GraphQL, and the Local API (and through relationship population)
without consumers stripping the extension client-side. A `forceSelect` keeps its input
(`filename`) selected even under a consumer's `select`.

## Seeding with `@pro-laico/payload-seed`

Because `icon` is a standard upload collection, it seeds **natively** — no script. Seed it like any
other collection with `defineCollectionSeed`: each record carries its source SVG on the `_file`
meta-key via the `file()` token. Put your source `.svg` files in the seed assets dir (the loader
searches the `svg/` subdir, so `assets/svg/star.svg` resolves from `file('star.svg')`):

```ts
// seed/icons.ts — each icon doc carries its SVG on `_file`
import { defineCollectionSeed } from '@pro-laico/payload-seed'

// assets/svg/star.svg, assets/svg/check.svg
export default defineCollectionSeed('icon', ({ file }) => [
  { _key: 'star', _file: file('star.svg') },
  { _key: 'check', _file: file('check.svg') },
])
```

Each doc is optimized on upload via the same `formatSVGHook`, and referenceable elsewhere in the
seed with `ref('icon', 'star')` (e.g. a page's icon relationship). Wire the definitions into the
seed plugin as usual:

```ts
import { iconsPlugin } from '@pro-laico/payload-icons'
import { seedPlugin } from '@pro-laico/payload-seed'
import icons from './seed/icons'

plugins: [iconsPlugin(), seedPlugin({ definitions: [icons /*, pages, … */] })]
```

Because `icon` is a real collection, its seed records are type-checked and other docs reference them
with `ref()` — this package never imports the seed package, so the two stay decoupled.

## License

MIT
