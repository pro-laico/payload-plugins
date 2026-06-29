# mux-sandbox

A minimal, self-contained Payload + Next.js app for testing
[`@pro-laico/payload-mux`](../../packages/payload-mux). SQLite (no external DB), local-disk
uploads, and just enough collections to exercise the plugin: a `mux-video` collection (added
by the plugin) and a `pages` collection that relates to it.

## Setup

```bash
cp .env.example .env.local                       # SQLite + placeholder Mux creds
pnpm install                                      # from the repo root
pnpm --filter mux-sandbox generate:types          # Payload types
pnpm --filter mux-sandbox generate:importmap      # admin import map
pnpm --filter mux-sandbox dev                      # http://localhost:3051/admin
```

Create the first admin user, then open **Videos**. The placeholder credentials boot the app
and render the admin UI; **actually uploading and playing back video requires a real Mux
account** — set `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and `MUX_WEBHOOK_SECRET` in `.env.local`
(the plugin reads them automatically), and point a Mux webhook at `<your-url>/api/mux/webhook`.

## What it exercises

- **The Videos collection** — the plugin's `mux-video` collection with the uploader field,
  Mux-populated metadata, and the `playbackOptions` array of virtual URLs.
- **Relationship usage** — `pages` links a video via a `relationship` field to `mux-video`,
  the typical consumer pattern.
- **Endpoints** — `POST/GET /api/mux/upload` (direct uploads) and `POST /api/mux/webhook`
  (sync), registered by the plugin.

## Seeding videos from local files

This sandbox wires up [`@pro-laico/payload-seed`](../../packages/payload-seed) so a `mux-video`
seeds **like an image asset** — declared with a `video()` source token and run by the normal
seed flow, no custom script. See `src/plugins/index.ts` (registers `muxAssetProvider()`) and
`src/seed/videos.ts` + `src/seed/pages.ts` (a video and a page that references it).

```bash
# 1. Put your real Mux credentials in .env.local (MUX_TOKEN_ID / MUX_TOKEN_SECRET)
# 2. Drop a clip in seed-assets/videos/ (gitignored) and point video('…') at it in src/seed/videos.ts
# 3. Set ENABLE_SEED=true, start the app, and click "Seed your database" in the admin header
#    (or POST /api/seed). The seed uploads the clip to Mux, waits for it to be ready, and
#    creates the mux-video + page docs.
```

Under the hood the seed engine resolves the `video()` source to the file under `seed-assets/videos/`,
hands it to the `mux-video` collection, and the **mux plugin's** `beforeValidate` hook uploads it
to Mux and folds in the asset metadata — the two plugins stay decoupled. Reseeds clear the
`mux-video` collection via `payload.delete`, so the `afterDelete` hook removes the old Mux assets
too (idempotent). For one-off programmatic creation, the mux plugin also exports `ingestMuxVideo()`.

> Seeding runs in-app (the admin button / `POST /api/seed`), so it avoids the upstream tsx
> `node:crypto` loader bug that breaks `payload run` scripts on Node 24 with the SQLite adapter.

## Tests

```bash
pnpm --filter mux-sandbox test
```

`tests/mux.int.spec.ts` boots this config against a temporary SQLite DB and asserts the
plugin wired itself in — the `mux-video` collection and its fields, the upload/webhook
endpoints, and that `mux-video` is a valid relationship target.

### Testing the webhook secret locally

Mux can't reach `localhost`, so the webhook never fires in local dev. The test covers it
**without a public site**: it signs payloads with a test `MUX_WEBHOOK_SECRET` using Mux's
exact scheme (`mux-signature: t=…,v1=HMAC_SHA256(secret, \`${t}.${body}\`)`) and drives the
registered `/mux/webhook` handler directly — asserting a valid signature applies the event
(doc updated) while a wrong/missing signature is rejected `401` and leaves the doc untouched.
No Mux account or network access needed.

For a true end-to-end check against Mux's own signed events, expose localhost with a tunnel
(`cloudflared tunnel --url http://localhost:3051` or ngrok), set that URL as the Mux webhook,
upload a clip, and watch real webhooks arrive (the Mux dashboard can resend them).

## Collections

| Collection | Purpose |
| --- | --- |
| `users` | Auth (admin login, the default upload/read gate). |
| `mux-video` | Added by the plugin — the Videos collection. |
| `pages` | Relates to a video via `heroVideo`. |
