# @pro-laico/payload-dev-tools

Dev-only tooling for Payload + Next.js apps, built for the human/AI iterative loop: the AI
proposes, you visually confirm.

**[Documentation →](https://payload-plugins.prolaico.com/docs/plugins/payload-dev-tools)**

Three pieces, three lines of wiring — everything hard-gated to `NODE_ENV === 'development'`
(endpoints and pages 404, the toolbar renders `null`):

```ts
// payload.config.ts
import { devToolsPlugin } from '@pro-laico/payload-dev-tools'
plugins: [devToolsPlugin()]
```

```tsx
// app/(frontend)/dev/[[...view]]/page.tsx — the /dev pages, one catch-all file
import { createDevPage } from '@pro-laico/payload-dev-tools/next'
export const dynamic = 'force-dynamic'
export default createDevPage()
```

```tsx
// app/(frontend)/layout.tsx — inside <body>
import { DevToolbar } from '@pro-laico/payload-dev-tools/toolbar'
<DevToolbar />
```

## What you get

- **The `/dev` pages** — real routes rendered by your own frontend (your fonts, your layout):
  `/dev` (overview + one-click seed / destructive reseed), `/dev/icons` (glyph grid + activate a
  different icon set with one click), `/dev/fonts` (specimens in the actual served fonts),
  `/dev/images` (grid through the transform endpoint), `/dev/mux`, and `/dev/tests/<test>` —
  one page per component test. The pages render content only; the toolbar is the navigation.
- **`<DevToolbar />`** — the one controller, floating on every page (admin too): browse the dev
  pages, toggle test versions, seed, read diagnostics — and it stays open while you navigate.
  Self-styled — no Tailwind, no CSS import, no `isDev` conditional.
- **`GET /api/dev`** — the machine-readable snapshot (env, installed plugins, seed status +
  counts, icon misses, font slots, mux readiness, per-collection doc counts) for
  `curl`/`fetch`/AI agents. Browsers get redirected to `/dev`.
- **A test harness** — `defineTest` versions are prop-less (optionally async) server components;
  each test is one page whose shown version the toolbar's chips control via a cookie
  (`GET /api/dev/stage?test=…&version=…` sets it via URL for screenshot tooling).
  `header`/`footer`-kind tests become **chrome overrides**: with one `resolveDevChrome` line in
  your layout, a toolbar chip swaps the variant into the real layout site-wide until you hit Real.

## Notes

- Three entry points, three contexts: `.` for `payload.config`, `/next` boots Payload (the
  drop-in page), `/toolbar` is a React component (your layouts).
- Sibling `@pro-laico/*` plugins are discovered via their `config.custom` markers — none are
  dependencies; panels appear for whatever is installed.
- Your own labs coexist with the catch-all: a static `app/(frontend)/dev/blocks/page.tsx` wins
  over it, and `<DevToolbar links>` puts it in the Pages view.
- `enabled: true` forces things on outside dev (a preview env) — the snapshot and pages are
  unauthenticated, so only do this where you'd hand out DB access anyway.
- Seeding needs `@pro-laico/payload-seed`, `ENABLE_SEED=true`, and a logged-in user; the seed
  card explains whichever is missing.
