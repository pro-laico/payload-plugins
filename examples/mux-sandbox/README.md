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
account** — set `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and `MUX_WEBHOOK_SIGNING_SECRET` in
`.env.local`, and point a Mux webhook at `<your-url>/api/mux/webhook`.

## What it exercises

- **The Videos collection** — the plugin's `mux-video` collection with the uploader field,
  Mux-populated metadata, and the `playbackOptions` array of virtual URLs.
- **Relationship usage** — `pages` links a video via a `relationship` field to `mux-video`,
  the typical consumer pattern.
- **Endpoints** — `POST/GET /api/mux/upload` (direct uploads) and `POST /api/mux/webhook`
  (sync), registered by the plugin.

## Tests

```bash
pnpm --filter mux-sandbox test
```

`tests/mux.int.spec.ts` boots this config against a temporary SQLite DB and asserts the
plugin wired itself in — the `mux-video` collection and its fields, the upload/webhook
endpoints, and that `mux-video` is a valid relationship target. Assertions are static, so
the test needs no Mux account or network access.

## Collections

| Collection | Purpose |
| --- | --- |
| `users` | Auth (admin login, the default upload/read gate). |
| `mux-video` | Added by the plugin — the Videos collection. |
| `pages` | Relates to a video via `heroVideo`. |
