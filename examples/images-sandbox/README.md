# images-sandbox

A minimal, self-contained Payload + Next.js app for testing
[`@pro-laico/payload-images`](../../packages/payload-images). SQLite (no external DB),
local-disk uploads, and just enough collections to exercise the plugin: the `images` +
hidden `generated-images` collections (added by the plugin) and a `pages` collection that
relates to an image. Everything — including on-demand optimization — runs on localhost.

## Setup

```bash
cp .env.example .env.local                        # SQLite + local-disk uploads
pnpm install                                       # from the repo root
pnpm --filter images-sandbox generate:types        # Payload types (+ the seed registry)
pnpm --filter images-sandbox generate:importmap     # admin import map (focal UI + seed button)
pnpm --filter images-sandbox dev                    # http://localhost:31052/admin
```

Create the first admin user. Then either open the home page (`/`) — a **visual gallery**
that seeds the samples and renders every image focal-cropped at multiple aspect ratios — or
open **Images** in the admin and upload your own (each needs `alt` text; drag the focus
point onto the subject). Request an optimized size directly:

```
GET /api/img/<image-id>?w=600&h=600&fit=cover        # focal cover-crop, auto format
GET /api/img/<image-id>?w=900&fmt=webp&q=80          # explicit width, format, quality
GET /api/img/<image-id>?w=1200&h=630&fit=cover&fmt=avif   # an OG-sized AVIF
```

The first request generates the variant with Sharp and caches it (see **generated-images**,
hidden by default); later requests stream the stored copy.

## Visual demo (the `/` page)

The home page is a self-contained test harness — no admin digging required:

- **Seed sample data** — a button (logged-in users) runs the same seed as the admin
  **Seed your database** button: three real photos (landscape / portrait / square) with
  focal points, plus a page referencing one. A **Reset** button clears everything.
- **Images gallery** — each seeded/uploaded image is rendered through `<ResponsiveImage>`
  at four crops (natural, 16:9, 1:1, 9:16), so you *see* the focal-aware cropping keep the
  off-center subject in frame across ratios, with the blur-up placeholder and a sample
  transform URL under each.
- **Pages** — the seeded `pages.heroImage` rendered through the same component, confirming
  the upload relationship + `asset()` resolution end to end.
- **`/responsive`** — one image full-bleed with `sizes="100vw"`; open the Network tab and
  resize to watch the browser pick a different `?w=` variant per screen width.

## What it exercises

- **The Images collection** — original-only upload, native focal point + the plugin's
  focal-preview picker, and the `variants` join onto the cache.
- **The transform endpoint** — `GET /api/img/:id` with focal-aware crop, format
  negotiation, dimension snapping, and immutable cache headers.
- **The purge endpoint** — `POST /api/img/purge/:id`, plus the change/delete hooks that
  purge stale variants automatically.
- **Relationship usage** — `pages.heroImage` is an `upload` field to `images`, the typical
  consumer pattern (render it with `<ResponsiveImage>`).

## Seeding images

This sandbox wires up [`@pro-laico/payload-seed`](../../packages/payload-seed). Because
`images` is a native Payload upload collection, it seeds with the normal `asset()` flow —
**no asset provider** (that seam is only for external bytes like Mux). `src/plugins/index.ts`
just points the seed plugin's asset uploads at `images` (`assets.collection: 'images'`);
`src/seed/assets.ts` declares the three committed sample photos (with focal points), and
`src/seed/pages.ts` creates a page referencing one of them.

```bash
# 1. Set ENABLE_SEED=true in .env.local
# 2. Start the app and click "Seed your database" in the admin header (or POST /api/seed)
```

The engine uploads `seed-assets/image/*.png` into `images` (carrying each spec's focal
point), then creates the page and resolves `asset('lighthouse')` to the uploaded id.
Reseeds clear the collections via `payload.delete`, so variants cascade away too.

## Tests

```bash
pnpm --filter images-sandbox test
```

`tests/images.int.spec.ts` boots this config against the test SQLite DB and asserts the
plugin wired itself in — the `images` / `generated-images` collections, the transform /
purge / seed endpoints, and `pages.heroImage` as an upload target — then drives the
transform endpoint end-to-end: a cache miss generates a focal-cropped WebP and persists a
variant, an identical request is a cache hit (no duplicate), `fmt=auto` negotiates WebP,
requested widths snap to the grid, and deleting the source cascades its variants away. No
network or external services needed — Sharp does the work locally.

## Collections

| Collection | Purpose |
| --- | --- |
| `users` | Auth (admin login, the default upload/read gate). |
| `images` | Added by the plugin — the source upload collection. |
| `generated-images` | Added by the plugin — the hidden variant cache. |
| `pages` | Relates to an image via `heroImage`. |
