# revalidate-sandbox

A minimal Payload + Next.js (Cache Components) app exercising `@pro-laico/payload-revalidate` end to end:

- **Read side (atomic)** — `src/lib/getters.ts`: id-lists via `cacheIds` (bare `posts` + the declared `featured` scope), id-keyed doc getters via `cacheDoc`, `cacheGlobal` — every card/reference self-fetches its own entry.
- **Write side** — zero-config hooks from `revalidatePlugin()` (added LAST in `src/plugins/index.ts`): edit a doc in the admin and exactly the touched tags bust.
- **Visibility** — `/dev/revalidate` (via `@pro-laico/payload-dev-tools`) shows the dependency graph, observed reads, and the bust-event log; `GET /api/revalidate-map` serves the same as JSON.
- **Seed integration** — the after-seed listener flushes the seeded surface once (`payload-seed` writes stay hook-quiet via `context.disableRevalidate`).
- **Sibling plugins, zero config** — `iconsPlugin()` + `imagesPlugin()` are registered with no revalidation wiring: their collections ship data-only `custom.revalidate` markers (`icon`/`iconSet` carry the shared `payload-icons` extra tag, `iconRequest` and `generated-images` opt out) that `revalidatePlugin()` picks up. The home page renders a `'use cache'` panel of inlined `<Icon>`s and a `<ResponsiveImage>` fed by an id-keyed `cacheDoc` getter.

## Try it

```bash
cp .env.example .env.local   # ENABLE_SEED=true is already set
pnpm dev                     # http://localhost:3055
```

1. Create the first admin user at `/admin`, seed via the admin button (or `/dev`).
2. Open `/` and a post detail page — the reads materialize (see them at `/dev/revalidate`).
3. Edit the post's excerpt in the admin → only that post's own entry purges; both id-lists and every other card stay cached. Flip `featured` → only `posts:list:featured` busts.
4. Edit the hero image's alt text → only the image's OWN entry (`media:{id}`) re-materializes — the post page holds just the id and survives.
5. Edit the payload-images doc (alt / focal point) → only `images:{id}` busts and the image card re-materializes with a fresh `v=` token. Rename the icon set (or re-upload an SVG) → the shared `payload-icons` tag busts and the cached icon panel re-materializes.
6. Reseed → one `seed` event busts the seeded surface (including `payload-icons`, since extra tags flush per touched slug).

## Tests

```bash
pnpm test   # boots the real config against a temp sqlite db and asserts the decision table via observed events
```
