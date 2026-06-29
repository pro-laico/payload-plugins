# @pro-laico/payload-mux

[Mux Video](https://www.mux.com/) for [Payload CMS](https://payloadcms.com/). Adds a
**Videos** collection that uploads directly to Mux, supports public or signed playback,
exposes virtual playback / poster / gif URLs, and keeps Payload and Mux in sync — delete in
one and it's gone from the other.

```bash
pnpm add @pro-laico/payload-mux @mux/mux-player-react
```

> Ported and maintained from [`@oversightstudio/mux-video`](https://github.com/oversightstudio/payload-plugins/tree/main/packages/mux-video) (MIT). Thanks to the original authors.

## Setup

Generate a token + webhook signing secret in the Mux dashboard, then add the plugin. Point
the Mux webhook at `/api/mux/webhook` (or `<your routes.api>/mux/webhook` if you've
customized Payload's API route).

### Public playback

```ts
import { buildConfig } from 'payload'
import { muxVideoPlugin } from '@pro-laico/payload-mux'

export default buildConfig({
  plugins: [
    muxVideoPlugin({
      enabled: true,
      initSettings: {
        tokenId: process.env.MUX_TOKEN_ID || '',
        tokenSecret: process.env.MUX_TOKEN_SECRET || '',
        webhookSecret: process.env.MUX_WEBHOOK_SIGNING_SECRET || '',
      },
      uploadSettings: {
        cors_origin: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      },
    }),
  ],
})
```

### Signed playback

Add the JWT key pair to `initSettings` and set the asset playback policy to `signed`:

```ts
muxVideoPlugin({
  enabled: true,
  initSettings: {
    tokenId: process.env.MUX_TOKEN_ID || '',
    tokenSecret: process.env.MUX_TOKEN_SECRET || '',
    webhookSecret: process.env.MUX_WEBHOOK_SIGNING_SECRET || '',
    jwtSigningKey: process.env.MUX_JWT_KEY_ID || '',
    jwtPrivateKey: process.env.MUX_JWT_KEY || '',
  },
  uploadSettings: {
    cors_origin: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    new_asset_settings: { playback_policy: ['signed'] },
  },
})
```

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `enabled` | `boolean` | **required** | Set `false` to skip the collection, endpoints, and hooks. |
| `initSettings` | `MuxVideoInitSettings` | **required** | Mux token id/secret + webhook secret (and the JWT key pair for signed playback). |
| `uploadSettings` | `MuxVideoUploadSettings` | **required** | `cors_origin` plus optional `new_asset_settings` (e.g. `playback_policy`). |
| `extendCollection` | `string` | — | Slug of an existing collection to extend instead of creating `mux-video`. |
| `access` | `(req) => boolean \| Promise<boolean>` | logged-in admin | Gate who can request uploads / read videos. |
| `signedUrlOptions` | `{ expiration?: string }` | `{ expiration: '1d' }` | Signed-URL lifetime. |
| `posterExtension` | `'webp' \| 'jpg' \| 'png'` | `'png'` | Poster image format. |
| `animatedGifExtension` | `'gif' \| 'webp'` | `'gif'` | Animated preview format. |
| `adminThumbnail` | `'gif' \| 'image' \| 'none'` | `'gif'` | List-view thumbnail style. |
| `autoCreateOnWebhook` | `boolean` | `false` | Backfill a Payload doc for assets uploaded directly in Mux. |

## Use a video

Relate to the `mux-video` collection, then play it back with `@mux/mux-player-react`:

```tsx
import config from '@payload-config'
import MuxPlayer from '@mux/mux-player-react'
import { getPayload } from 'payload'

export default async function Page() {
  const payload = await getPayload({ config })
  const video = await payload.findByID({ collection: 'mux-video', id: 'example' })
  const playback = video.playbackOptions![0]

  return <MuxPlayer src={playback.playbackUrl!} poster={playback.posterUrl!} />
}
```

## License

MIT
