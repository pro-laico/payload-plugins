# @pro-laico/payload-images

On-demand image optimization for [Payload CMS](https://payloadcms.com/). Adds an
**Images** upload collection that stores only the original; every rendered size is
generated the first time a page asks for it — resized and cropped to a focal point you
set in the admin, encoded to WebP/AVIF/JPEG/PNG — then cached so it's only ever built
once. Ships a responsive `<ResponsiveImage>` component with a built-in low-res
placeholder, an admin focal-point picker, and two-way variant purging.

> **Ported from [`@pro-laico/images`](https://github.com/pro-laico/atomic-payload) (the
> Atomic Payload images package)**, restructured to this repo's conventions and stripped
> to the image-optimization core — no favicons, no Atomic block/children coupling. Just
> the Images pipeline plus declarative seeding.

```bash
pnpm add @pro-laico/payload-images
```

## Setup

The transform endpoint resizes and crops with [Sharp](https://sharp.pixelplumbing.com/),
which Payload already needs — pass the same instance to `buildConfig`:

```ts
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { imagesPlugin } from '@pro-laico/payload-images'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export default buildConfig({
  sharp, // required — the endpoint resizes/crops with Sharp
  serverURL, // used to read originals from cloud/relative storage (also set as the request origin)
  plugins: [imagesPlugin()],
})
```

This registers the **Images** collection (you upload here; the original is stored
untouched), a hidden **generated-images** collection (the variant cache, one row per
generated size), both under an **Assets** admin group. It mounts the transform endpoint
at `/api/img/:id` and a purge endpoint at `/api/img/purge/:id`. The admin list view shows
fast on-demand thumbnails (160px, focal-cropped) instead of loading full-res originals.

> **Already have a `media`/`images` collection?** Pass `imagesPlugin({ extendCollection: 'media' })`
> to add the pipeline (focal UI, the `variants` join, purge hooks, `upload.focalPoint`) to
> your existing upload collection instead of creating a second one — no migration. See
> [Extending an existing collection](#extending-an-existing-collection).

Keep Sharp out of the client bundle (Turbopack and webpack both need this):

```ts
// next.config.ts
const nextConfig = { serverExternalPackages: ['sharp'] }
export default nextConfig
```

The focal-point picker and **Purge variants** button are admin components, so regenerate
the import map after adding the plugin:

```bash
pnpm payload generate:importmap
```

### Server URL

On a cloud or relative-URL storage adapter, the endpoint reads the original by fetching
the server's own file route, so it needs your origin. It uses your buildConfig
**`serverURL`** (the `serverURL` in the snippet above) — so if you've set that, there's
nothing else to do. With no `serverURL`, it falls back to `NEXT_PUBLIC_SERVER_URL`, then
the live request origin, then `http://localhost:3000`.

> **`focalUI: false` = a clean editor collection.** `focalUI` bundles all the image-management
> admin UI — the focal picker, ratio preview, purge button, and the **Variants** list. Turn it
> off and the collection is just `alt` + the file (handy for content editors), and you can skip
> `generate:importmap` entirely. On-demand transforms still work — you only lose the in-admin tools.

## Rendering with `<ResponsiveImage>`

`<ResponsiveImage>` emits a plain `<img>` whose `srcset` points at the transform
endpoint, so the browser downloads the one size that fits. It's not `next/image`, and it
runs in both server and client trees. Import it from the `components/image` subpath:

```tsx
import { getPayload } from 'payload'
import config from '@payload-config'
import { ResponsiveImage } from '@pro-laico/payload-images/components/image'

export async function Hero({ id }: { id: string }) {
  const payload = await getPayload({ config })
  const image = await payload.findByID({ collection: 'images', id, depth: 0 })
  return <ResponsiveImage image={image} aspectRatio="16:9" sizes="(max-width: 768px) 100vw, 50vw" />
}
```

Pass the **populated document** when you can — it fills in the intrinsic width/height (no
layout shift), the `alt` fallback, and the cache-busting version token. The endpoint
reads the focal point from the document and crops server-side.

> **Set `sizes` to how big the image actually renders.** It defaults to `100vw`; leaving that
> on an image that sits in a small column makes the browser download a full-width variant it
> doesn't need (the same trap as `next/image`). Give it the rendered size — e.g.
> `sizes="(max-width: 768px) 100vw, 33vw"` for a third-width image. See
> [MDN: responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images).

For a full-bleed hero or any element that sets its own height, pass `fill`:

```tsx
<div style={{ position: 'relative', height: '100vh' }}>
  <ResponsiveImage image={image} fill sizes="100vw" />
</div>
```

Need a single URL (OG tags, CSS backgrounds, emails)? Use `getImageUrl` from the
`components/buildSrcset` subpath:

```ts
import { getImageUrl } from '@pro-laico/payload-images/components/buildSrcset'

const ogUrl = getImageUrl(image, { width: 1200, aspectRatio: '1.91:1', baseUrl: process.env.NEXT_PUBLIC_SERVER_URL })
```

## Options

`imagesPlugin(options?)` accepts:

| Option | Type | Default | |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Set `false` to register nothing (drops the tables on SQL adapters). |
| `extendCollection` | `string` | — | Slug of an existing **upload** collection to add the pipeline to, instead of creating `images`. |
| `imagesOverrides` | `Partial<CollectionConfig>` | — | Tweaks deep-merged onto the Images collection (`upload`/`access`/`admin` merged, `fields`/`hooks` appended). |
| `generatedImagesOverrides` | `Partial<CollectionConfig>` | — | Tweaks for the hidden variant-cache collection. |
| `pregenerateSizes` | `boolean \| ImageSize[]` | `false` | Opt into Payload's classic on-upload size ladder instead of on-demand. `true` = built-in 7-size ladder; array = custom. |
| `transform` | `TransformEndpointConfig \| false` | `{}` | Transform + purge endpoint config; `false` registers neither. |
| `focalUI` | `boolean` | `true` | Render the focal picker + ratio preview and the Purge button. |
| `previewRatios` | `string[]` | `['16:9','9:16','1:1','4:3','3:2','21:9']` | Aspect ratios shown as focal-preview tiles. |
| `virtualFields` | `boolean` | `true` | Add computed `src`/`srcset`/`placeholderURL`/`thumbnailURL` fields to every read. |
| `localizeAlt` | `boolean` | `false` | Mark `alt` `localized` (needs Payload localization). Ignored with `extendCollection`. |

`transform` keys (all optional): `sourceSlug` (`'images'`), `variantSlug`
(`'generated-images'`), `cdnCacheControl` (`true`), `maxDimension` (`4096`),
`defaultQuality` (`75`), `qualityRange` (`[40, 95]`), `defaultFormat` (`'auto'`),
`formats` (`['auto','avif','webp','jpeg','png']`), `preferAvif` (`false`),
`dimensionStep` (`50`), `maxInputPixels` (`100_000_000`), `maxConcurrency` (`cpus - 1`),
`sharpConcurrency` (`1`).

## Extending an existing collection

Most projects already have a `media` (or `images`) upload collection. Point the plugin at it
with `extendCollection` and it adds the pipeline — the focal UI, the `variants` join, the purge
hooks, and `upload.focalPoint` — to **that** collection, instead of creating a second one:

```ts
imagesPlugin({ extendCollection: 'media' })
```

The transform endpoint then serves `/api/img/:id` for `media` docs, and the variant cache
relates back to `media`. The target must be an upload collection (the plugin throws a clear
error otherwise). `pregenerateSizes` is ignored in this mode — your collection already owns its
`imageSizes`.

> **Custom API route or Next `basePath`?** The transform URLs default to `/api/img`. If you've
> changed Payload's `routes.api` (or set a Next `basePath`), pass `path` to the component once via
> a wrapper: `const Image = (p: ResponsiveImageProps) => <ResponsiveImage path="/myapi/img" {...p} />`.

## Optimized URLs in the API (no client needed)

`<ResponsiveImage>` and `getImageUrl` are for JS/React. For everyone else — a mobile app, a
GraphQL client, a plain `fetch`, an RSS/OG generator — the plugin adds **virtual fields** that
compute optimized URLs on read, so they ride along in every REST / GraphQL / Local-API response
with no client code and no knowledge of `/api/img`:

```jsonc
// GET /api/images/<id>  (or a populated page.heroImage)
{
  "id": "...", "alt": "...", "width": 2400, "height": 1600,
  "src": "https://site.com/api/img/<id>?w=1280&fit=cover&q=75&fmt=auto&v=…",
  "srcset": "https://site.com/api/img/<id>?w=320… 320w, …",
  "placeholderURL": "https://site.com/api/img/<id>?w=32&q=40…", // LQIP / blur-up
  "thumbnailURL": "https://site.com/api/img/<id>?w=160&h=160&fit=cover…"
}
```

They're absolute when `serverURL` is set, relative otherwise; hidden in the admin; and **flow
through relationship population** — a populated `page.heroImage` already carries `srcset` /
`placeholderURL`, ready to render. Population is kept lean (`defaultPopulate`): relations return
these renderable fields and **not** the `variants` cache join (which would cost an extra query).
Turn the fields off with `virtualFields: false`.

The resolved config (slugs + options) is also stashed on `config.custom.payloadImages`, so
decoupled tooling (an OG/sitemap generator, a CDN-purge script, a migration) can read it from
just `payload` — no import.

## Admin & Payload built-ins

The `images` collection leans on Payload's native upload features, so it behaves like any
collection you'd build yourself:

- **Upload-field previews + alt search, on by default.** Relationship/`upload` fields that target
  `images` show a thumbnail (`upload.displayPreview`), the list view searches by `alt`, and the
  list shows the fast on-demand thumbnail from above. (`extendCollection` targets keep their own
  admin config.)
- **Organize a big library with folders.** Payload's built-in folder organization is opt-in (it
  adds a folder relationship to the schema). Turn it on when you want it:
  ```ts
  imagesPlugin({ imagesOverrides: { folders: true } })
  ```
- **Cap stored originals.** The endpoint never serves an upscaled image, but the *stored* original
  is whatever was uploaded. To bound storage, hand Payload's built-in `resizeOptions` a ceiling —
  applied once, on upload:
  ```ts
  imagesPlugin({
    imagesOverrides: { upload: { resizeOptions: { width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true } } },
  })
  ```
- **Add images by URL.** Payload's `upload.pasteURL` lets editors paste an image URL to import it
  (guarded by an allow-list). Leave it at Payload's default or configure it via `imagesOverrides`.

## Caching & abuse limits

- **Variant cache** (`generated-images`). The first request for a size generates it and
  stores it; later requests stream the stored copy. Replacing the file or moving the
  focal point purges that image's stale variants (the change/delete hooks); the **Purge
  variants** button and `POST /api/img/purge/:id` clear them on demand.
- **Browser/CDN cache.** Transform responses are immutable and each URL carries a `v`
  token derived from the source's filename + focal point — replace the file or move the
  focal and already-cached responses refetch; a metadata-only edit (`alt`) doesn't.
- **Bounded variant space.** Requested dimensions snap to the `dimensionStep` grid and
  quality buckets to a small set, both clamped to `maxDimension`, so a caller can't spin
  up unbounded variants with `w=1,2,3,…`. Output never upscales past the source.
- **Bounded work.** `maxInputPixels` caps how many pixels Sharp decodes (a
  decompression-bomb + memory guard); a concurrency gate keeps a cold page that requests
  many sizes from saturating CPU.
- **SSRF + path traversal.** Local reads stay inside the collection's `staticDir`;
  cloud/relative reads self-fetch with redirects disabled, a 15s timeout, a 64MB cap, and
  refuse loopback / private / link-local hosts (while still allowing your configured
  origin).
- **Access control.** Source reads run with the collection's access rules. A source you
  can't read returns `404`; a non-public source is served `private` with no shared CDN
  caching. The purge endpoint requires a logged-in user who can read that source.

## Seeding with `@pro-laico/payload-seed`

The `images` collection is a normal Payload upload, so it seeds natively through
[`@pro-laico/payload-seed`](../payload-seed) — no asset provider needed (unlike
`@pro-laico/payload-mux`, whose bytes live in Mux). Point the seed plugin's asset uploads
at the `images` collection and declare each source with `asset()`:

```ts
import { defineAssets, defineSeed, seedPlugin } from '@pro-laico/payload-seed'
import { imagesPlugin } from '@pro-laico/payload-images'

// seed/assets.ts — uploaded FIRST; focal points drive the on-demand crops
const assets = defineAssets({
  hero: { file: 'hero.jpg', alt: 'Hero', focalX: 78, focalY: 32 },
})

// seed/pages.ts — reference an uploaded image by token
const pages = defineSeed('pages', ({ asset }) => [{ _key: 'home', title: 'Home', heroImage: asset('hero') }])

plugins: [
  imagesPlugin(),
  // upload assets into `images` (not the default `media`)
  seedPlugin({ definitions: [assets, pages], assets: { dir: 'seed-assets', collection: 'images' } }),
]
```

`focalX`/`focalY` on a spec set the upload's focal point, so the seeded images crop to
the right subject the moment the transform endpoint serves them. See
[`examples/images-sandbox`](../../examples/images-sandbox) for a full working setup.

## License

MIT
