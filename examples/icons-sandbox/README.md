# icons-sandbox

A minimal, self-contained Payload + Next.js app for testing
[`@pro-laico/payload-icons`](../../packages/payload-icons). SQLite (no external DB), local-disk
uploads, and just enough to exercise the plugin: the `icon` collection (added by the plugin), a
`pages` collection that relates to it, and a **CVA + Tailwind showcase** home page that renders
the seeded icons across the variant / size / tone axes you'd use in a real app.

## Setup

```bash
cp .env.example .env.local                          # SQLite + local config (works as-is)
pnpm install                                         # from the repo root
pnpm --filter icons-sandbox generate:types           # Payload types
pnpm --filter icons-sandbox generate:importmap       # admin import map
pnpm --filter icons-sandbox dev                       # http://localhost:3054
```

Create the first admin user at `/admin`, then open **Icons** and upload an SVG — it's optimized
and sanitized on save (try one with a hard-coded `fill` and a `<script>`: the fill becomes
`currentColor` and the script is stripped). The home page at `/` lists every stored icon, rendered
inline and tinted via CSS `color`.

## What it exercises

- **The Icon collection** — the plugin's `icon` SVG-upload collection, with the `formatSVGHook`
  optimizer (svgo + viewBox tightening + `currentColor`) and the stored `svgString` / `optimized`
  fields.
- **Frontend rendering (CVA + Tailwind)** — the common-usage pattern. Two small components show
  how an app wraps the plugin's primitive:
  - `src/components/ui/Icon.tsx` — a [`cva`](https://cva.style) presentational component (`svg` +
    `variant` / `size` / `tone`) over `@pro-laico/payload-icons/components/Icon`, styled with
    `cn()` (clsx + tailwind-merge) and shadcn-style tokens.
  - `src/components/ui/CmsIcon.tsx` — the ergonomic, name-based server wrapper: resolves an icon
    by name with `getIcon` and renders the styled `<Icon>`. So you write `<CmsIcon name="star"
    variant="solid" size="lg" tone="primary" />`.
  - `src/app/(frontend)/page.tsx` — the showcase grid. The **tone** row is the headline: one
    source SVG recolored (muted / primary / accent / destructive) purely via `currentColor` and a
    class name, because the optimizer rewrites fills to `currentColor` on upload.
- **Relationship usage** — `pages` links an icon via a `relationship` field, the typical consumer
  pattern.

## Seeding icons

Because `icon` is a standard upload collection, it seeds **natively** through
[`@pro-laico/payload-seed`](../../packages/payload-seed) — no `custom.seedAsset` marker, no custom script. The
sample SVGs live in `seed-assets/icon/` (committed), declared in `src/seed/icons.ts` with
`defineSeed('icon', ({ file }) => [{ _key: 'star', _file: file('star.svg') }, …])`;
`src/seed/pages.ts` references one via `ref('icon', 'star')`.

```bash
# .env.local already sets ENABLE_SEED=true. Start the app, create an admin user, then click
# "Seed your database" in the admin header (or POST /api/seed). The seed uploads each SVG to the
# icon collection (optimizing it), then creates the page that references one.
```

The engine resolves each icon doc's `_file` to a file under `seed-assets/icon/`, uploads it to the
`icon` collection (running the optimize hook), and resolves `ref('icon', 'star')` to the created
icon's id. Reseeds clear the `icon` collection first, so the run is idempotent. Icons seed as
ordinary docs — this sandbox's seed never couples the seed package to the icons package.

> Seeding runs in-app (the admin button / `POST /api/seed`), so it avoids the upstream tsx
> `node:crypto` loader bug that breaks `payload run` scripts on Node 24 with the SQLite adapter.

## Tests

```bash
pnpm --filter icons-sandbox test
```

`tests/icons.int.spec.ts` boots this config against a temporary SQLite DB and asserts the plugin
wired itself in — the `icon` upload collection and its fields, the seed endpoint, and that `icon`
is a valid relationship target — then **uploads an SVG and verifies it was optimized and sanitized**
(fill → `currentColor`, `<script>`/`onclick` stripped).

## Collections

| Collection | Purpose |
| --- | --- |
| `users` | Auth (admin login, the default write gate). |
| `icon` | Added by the plugin — the SVG icons collection. |
| `pages` | Relates to an icon via `icon`. |
