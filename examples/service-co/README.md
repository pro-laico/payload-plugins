# service-co

A complete example site — **Meridian**, a fictional design-build studio — built on Payload CMS +
Next.js that uses **all five `@pro-laico/*` plugins at once**. It's the broadest test app in the
repo: where each `*-sandbox` exercises one plugin in isolation, this wires them together the way a
real project would, and doubles as an easy way to eyeball several plugins on one screen.

Everything is CMS-managed: the photos, the icons, the typography, the (optional) video, and every
word of content. It runs on SQLite + local-disk uploads with **no external services** — clone,
install, seed, and it works as-is. Mux is the one optional add-on (see below).

## The plugins, and where to see each

| Plugin | In this app |
| --- | --- |
| [`payload-images`](../../packages/payload-images) | Every photo — hero, service shots, project covers + galleries, team portraits. Stores only the original; each size is generated + focal-cropped on demand and rendered through `<ResponsiveImage>` with an inline LQIP. |
| [`payload-icons`](../../packages/payload-icons) | The service glyphs and UI/contact icons — SVGs optimized + sanitized to `currentColor` on upload. Service cards render their related `icon` directly; the header/footer/contact use the `<Icon name>` drop-in resolved through the active icon set. |
| [`payload-fonts`](../../packages/payload-fonts) | The brand typography — a display face for the wordmark/hero, a serif for headings, a sans for body. Applied as `--font-set*` CSS variables (via `<DevFonts>` in dev, `next/font` in prod). |
| [`payload-mux`](../../packages/payload-mux) | An **optional** showreel + per-project video. Credential-gated: with `MUX_*` env vars the seed ingests a clip and the home hero / project pages play it; without them, those sections are simply skipped. |
| [`payload-seed`](../../packages/payload-seed) | Fills every collection and global above from `src/seed/`, resolving all cross-references (`ref()`) and attaching upload files (`file()`) — the same data the admin **Seed your database** button creates. |

## Content model

Collections: `services`, `projects` (cover + gallery + optional video + related services),
`team`, `testimonials`, plus `users`. Global: `site-settings` (brand, contact, hero image,
featured project, optional showreel). The plugins inject the rest — `images`, `generated-images`,
`icon`, `iconSet`, `mux-video`, `font`, `fontOriginal`, `fontOptimized`, `fontSet`.

Frontend (`src/app/(frontend)`): a home page, `/services`, `/work` + `/work/[slug]`, `/about`,
and `/contact` — a small but complete marketing site, Tailwind v4.

## Run it

```bash
pnpm install                 # from the repo root
cp .env.example .env.local   # in this folder

pnpm --filter service-co dev # http://localhost:3060
```

Then open [`/admin`](http://localhost:3060/admin), create the first user, and click **Seed your
database** (needs `ENABLE_SEED=true`, which `.env.example` sets). Reload the site — the whole thing
is populated. Uploading your own images/icons/fonts in the admin works too.

- `pnpm --filter service-co test` — an integration test that drives the full offline seed and
  asserts every plugin wired up.
- `pnpm --filter service-co generate:types` / `generate:importmap` — regenerate the Payload types
  and admin import map after changing collections.

### Enabling video (Mux)

Optional. Add real Mux credentials to `.env.local`:

```bash
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...
```

With them present, seeding also ingests the sample clip (`seed-assets/mux-video/showreel.mp4`) into
Mux, populating the `mux-video` collection. Attach it in the admin — **Site Settings → Showreel**
(plays in the home hero) or a **project's Video** field (plays on the project page) — to see it
back. Without credentials, seeding stays fully offline and the video sections simply don't render.

> The seed never references `mux-video` with a `ref()` token on purpose: the dev server regenerates
> the seed-ref types on boot, and without Mux credentials it would drop `mux-video` from the
> registry and break the ref. Keeping the association a one-click admin step keeps types stable
> either way.

## Assets

The photos are AI-generated for this demo; the icons are simple single-colour glyphs; the four
typefaces are open-source subsets carried over from `fonts-sandbox`. All are placeholders — swap in
your own in the admin or under `seed-assets/`.
