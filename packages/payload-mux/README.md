# @pro-laico/payload-mux

[Mux Video](https://www.mux.com/) for [Payload CMS](https://payloadcms.com/). Adds a
**Videos** collection that uploads directly to Mux, supports public or signed playback,
exposes virtual playback / poster / gif URLs, and keeps Payload and Mux in sync — delete in
one and it's gone from the other.

> **Based on [`@oversightstudio/mux-video`](https://github.com/oversightstudio/payload-plugins) (MIT)**,
> originally created by [Idan Yekutiel](https://github.com/idanyekutiel). A port of that Mux
> plugin, restructured to our conventions and kept as a first-party package so we can track
> Payload and Mux updates directly. Full credit and thanks to the original author.

```bash
pnpm add @pro-laico/payload-mux
```

## Setup

Set your Mux credentials as the **standard `MUX_*` environment variables** — the plugin (and
the Mux SDK) read them automatically, so adding the plugin takes no arguments:

```bash
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...        # for signed playback also: MUX_SIGNING_KEY, MUX_PRIVATE_KEY
```

```ts
import { buildConfig } from 'payload'
import { muxVideoPlugin } from '@pro-laico/payload-mux'

export default buildConfig({
  plugins: [muxVideoPlugin()],
})
```

Point the Mux webhook at `/api/mux/webhook` (or `<your routes.api>/mux/webhook` if you've
customized Payload's API route). `cors_origin` for uploads defaults to
`process.env.NEXT_PUBLIC_SERVER_URL`.

### Overriding

Pass options only to override a default — e.g. a non-standard env var name, signed playback,
or a custom CORS origin. Any `initSettings` field you omit still falls back to its `MUX_*` env
var:

```ts
muxVideoPlugin({
  initSettings: { webhookSecret: process.env.MY_WEBHOOK_SECRET }, // tokenId/secret still from env
  uploadSettings: {
    cors_origin: 'https://mysite.com',
    new_asset_settings: { playback_policy: ['signed'] },          // signed playback
  },
})
```

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Set `false` to skip the collection, endpoints, and hooks. |
| `initSettings` | `MuxVideoInitSettings` | `MUX_*` env vars | Override Mux credentials per-field; omitted fields read their `MUX_*` env var. |
| `uploadSettings` | `MuxVideoUploadSettings` | `cors_origin` from `NEXT_PUBLIC_SERVER_URL` | `cors_origin` plus optional `new_asset_settings` (e.g. `playback_policy`). |
| `extendCollection` | `string` | — | Slug of an existing collection to extend instead of creating `mux-video`. |
| `access` | `(req) => boolean \| Promise<boolean>` | logged-in admin | Gate who can request uploads / read videos. |
| `signedUrlOptions` | `{ expiration?: string }` | `{ expiration: '1d' }` | Signed-URL lifetime. |
| `posterExtension` | `'webp' \| 'jpg' \| 'png'` | `'png'` | Poster image format. |
| `animatedGifExtension` | `'gif' \| 'webp'` | `'gif'` | Animated preview format. |
| `adminThumbnail` | `'gif' \| 'image' \| 'none'` | `'gif'` | List-view thumbnail style. |
| `autoCreateOnWebhook` | `boolean` | `false` | Backfill a Payload doc for assets uploaded directly in Mux. |

## Seeding videos from local files

To seed `mux-video` docs from local clips (uploading them to Mux exactly as the admin uploader
would — handy for getting content from local into a live Mux account without committing video
files), use the **seed plugin's** Mux helper, [`@pro-laico/payload-seed/mux`](../payload-seed#mux-video-seeding):

```ts
import { seedMuxVideos } from '@pro-laico/payload-seed/mux'

await seedMuxVideos(payload, { dir: 'seed-assets', clear: 'tagged', videos: [{ title: 'Intro', file: 'intro.mp4' }] })
```

It reads this plugin's credentials by convention (the two packages stay decoupled — neither
imports the other; the Mux SDK ships with the seed plugin). This plugin cooperates passively:
its `beforeChange` hook skips the Mux round-trip for pre-resolved (seeded) data.

## Use a video

Relate to the `mux-video` collection, then play it back however you like — `playbackId` and the
virtual `playbackUrl` (an HLS `.m3u8`) work with any Mux frontend or a custom HLS player. The
example below uses [`@mux/mux-player-react`](https://www.npmjs.com/package/@mux/mux-player-react)
(`pnpm add @mux/mux-player-react` if you go that route):

```tsx
import config from '@payload-config'
import MuxPlayer from '@mux/mux-player-react'
import { getPayload } from 'payload'

async function Page() {
  const payload = await getPayload({ config })

  const video = await payload.findByID({
    collection: 'mux-video',
    id: 'example',
  })

  return (
    <MuxPlayer
      // Using the playback ID
      playbackId={video.playbackOptions![0].playbackId!}
      // Or use the playback URL
      src={video.playbackOptions![0].playbackUrl!}
      // Poster
      poster={video.playbackOptions![0].posterUrl!}
    />
  )
}

export default Page
```

## The webhook

On upload, the `beforeChange` hook polls the asset for ~6 seconds and fills in playback
metadata if Mux finishes encoding by then; slower videos are saved with just their `assetId`
and rely on the webhook. So the webhook is needed for: **metadata on videos that take longer
than ~6s to encode** (without it they never get `playbackOptions`, so they don't play),
**Mux → Payload delete sync**, and **`autoCreateOnWebhook` backfill**. It is _not_ needed for
the upload itself, short-video metadata, Payload → Mux delete (the `afterDelete` hook), or
seeding (`seedMuxVideos` writes full metadata itself).

**It requires a publicly reachable URL** — Mux pushes events to your endpoint, so its servers
must be able to POST to it. The Mux SDK only verifies the signature on the receiving end; it
can't make Mux reach `localhost`. In production, set `MUX_WEBHOOK_SECRET` in the deployed env
and point the dashboard webhook at `https://your-site/api/mux/webhook`. For local dev, expose
localhost with a tunnel (`cloudflared`/`ngrok`) and keep `MUX_WEBHOOK_SECRET` in your local env.

## License

MIT
