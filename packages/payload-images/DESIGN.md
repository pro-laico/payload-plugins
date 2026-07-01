# @pro-laico/payload-images — design

On-demand image optimization for Payload CMS. An upload stores only the original; every
rendered size is generated the first time it's requested (resized, focal-cropped,
re-encoded), cached as a durable variant, and streamed same-origin. This is a port of the
Atomic Payload images package (`@pro-laico/images`), trimmed to the image core and
re-pointed at this repo's conventions.

## What this is (and isn't)

- **Is:** a source `images` upload collection, a hidden `generated-images` variant cache,
  an on-demand Sharp transform endpoint (`/api/img/:id`) with focal-aware cropping +
  format negotiation + built-in LQIP placeholders, a two-way purge (hooks + endpoint), an
  admin focal-point picker, an async-server-component `<ResponsiveImage>`, and isomorphic `buildSrcset` builders.
- **Isn't:** favicons, the Atomic `ImageChild` block, the Atomic children renderer, or the
  `@pro-laico/core` cache-tag layer. Those were dropped in the port — this package depends
  only on Payload + Next + React + (optional) Sharp, like the other plugins in this repo.

## Ported from Atomic Payload — what changed

- **Removed** the `favicons` collection + `FaviconField`, the `blocks/imageChild` block
  and its server component (they import `@pro-laico/atomic`), the `cache` module
  (`getCachedImage`, which needs `@pro-laico/core/config` + cache primitives), and the
  `schema` augment stub.
- **Inlined** the two `@pro-laico/core` helpers the kept code used: `mergeCollection` (+
  its `mergeHooks`) into `src/lib/mergeCollection.ts`, and `getServerSideURL` into
  `src/lib/getServerSideURL.ts`. No shared-utility dependency remains.
- **Dropped** the `@pro-laico/core` cache-revalidation hooks from the Images collection.
  Only the variant-purge hooks remain, which is the part that matters for correctness; a
  consuming app wires its own page-cache revalidation if it wants it.
- **Renamed** the admin component import-map paths to `@pro-laico/payload-images/admin/*`.

## Architecture

```
upload (original only)
        │
        ▼
  images collection ──(join)──▶ generated-images (variant cache, hidden, upload)
        │  hooks: purge stale on file/focal change, purge all on delete
        ▼
GET /api/img/:id?w&h&ar&fit&q&fmt
  parse+clamp params ─▶ read source (access-checked, coalesced)
  ─▶ cache hit? stream stored variant
  ─▶ miss: Sharp transform (focal cover-crop) ─▶ stream ─▶ persist variant via after()
```

Key design points carried over from the original:

1. **Original-only storage, on-demand everything.** Uploads never pre-generate a size
   ladder — the original is stored untouched. Every variant is built lazily and cached, so
   storage scales with what's actually requested.
2. **Deterministic variant keys.** `variantCacheKey` folds source id + filename + focal +
   transform params + resolved format into a short hash. The key goes stale exactly when
   the purge hook fires (file replace / focal edit), so unreachable variants are removed
   in lockstep instead of orphaned; a metadata-only edit leaves them reachable.
3. **Bounded, public-facing endpoint.** Dimension snapping + quality bucketing bound the
   variant space (anti-DoS); `maxInputPixels` bounds decode memory; a FIFO concurrency
   gate + single-libvips-thread default bound CPU on serverless; an SSRF + path-traversal
   guard bounds source reads. See the README's "Caching & abuse limits".
4. **Single-flight coalescing.** A cold page fires every srcset width at once. The source
   read is deduped per id, and variant generation is coalesced per cache key, so the
   expensive read+encode runs once under a thundering herd.
5. **Storage-adapter agnostic.** Both collections are uploads, so each variant is stored
   through whatever adapter is configured. Local reads hit `staticDir`; cloud/relative
   reads self-fetch Payload's own file route — which is why the endpoint needs an origin. It
   uses Payload's `config.serverURL`, falling back to `NEXT_PUBLIC_SERVER_URL` and then the live
   request origin.
6. **Isomorphic geometry.** `transform/geometry.ts` (focal crop math) is pure and imported
   by both the server endpoint and the admin focal preview, so the ratio tiles in the
   admin match what the endpoint renders.

## Seeding

Unlike `@pro-laico/payload-mux` (whose bytes live in Mux and so needs a seed *asset
provider* seam), `images` is a plain Payload upload collection. So it seeds **natively**
through `@pro-laico/payload-seed`, like any collection: `defineSeed('images', …)`,
each record carrying its source file on `_file` via the `file()` token, and referenced
elsewhere with `ref('images', …)`. The record's `focalX`/`focalY` fields set the upload's
focal point, so seeded images crop correctly on first render. No provider, no custom
script. See `examples/images-sandbox`.

## Module map

- `plugin.ts` — the plugin factory; registers collections + endpoints, deep-merges
  overrides via the inlined `mergeCollection`. With `extendCollection`, it folds
  `imageEnhancements()` onto an existing upload collection instead of creating `images`.
- `collections/images.ts` — the source upload collection (alt, focal UI, variants join,
  purge hooks).
- `collections/generatedImages.ts` — the hidden variant cache (cacheKey unique index,
  source relationship).
- `endpoints/transform.ts` — the `/img/:id` transform handler + `/img/purge/:id`.
- `transform/*` — pure params parsing, focal geometry, the Sharp pipeline, source byte
  reading (SSRF-guarded), the concurrency gate, the lazy Sharp loader, single-flight.
- `variants/key.ts` — the deterministic cache key.
- `hooks/purge.ts` — stale-on-change + all-on-delete variant purging.
- `utils/urls.ts` — isomorphic URL/srcset builders (client-safe).
- `components/image.tsx` — `<ResponsiveImage>` (server-rendered, LQIP placeholder).
- `components/admin/*` — the focal-point picker and purge button (client components).
- `lib/*` — the inlined `mergeCollection` + `getServerSideURL`.

## Open / later

- **Page-cache revalidation** was the one piece intentionally not ported (it rode
  `@pro-laico/core`'s cache-tag system). A consuming app adds its own `afterChange` /
  `afterDelete` revalidation if it caches image reads at the page layer.
- **Per-URL request signing** isn't implemented — the endpoint is gated by the bounds
  above rather than a shared secret. Put a rate limiter / CDN in front for fully untrusted
  traffic, or lower `pixelStep` / `maxDimension` / `maxInputPixels`.
