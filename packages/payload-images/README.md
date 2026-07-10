# @pro-laico/payload-images

On-demand image optimization for [Payload CMS](https://payloadcms.com/) — an Images collection that stores only the original and generates, crops, and caches each rendered size on first request, with a responsive `<ResponsiveImage>` component and admin focal-point picker.

```bash
pnpm add @pro-laico/payload-images
```

Placeholders are a **quality-tier ladder** stored on the doc at upload time: five BlurHash
strings (`xs`…`xl`) plus two micro-webp data URIs (`xxl`/`x3`). A read that declares what it's
rendering (`req.context.blurhash = { ar, quality }`) gets a **finished, focal-cropped data URI**
back from the virtual `croppedBlurHash` field — the processing happens in the field hook, and
`<ResponsiveImage>` just paints it. The same upload-time decode also stores a Sanity-style color
**palette**, `hasAlpha`/`isOpaque` flags, and a saliency-based initial **focal point** (applied
only when the editor hasn't picked one).

## Migrating an existing project

Images uploaded before the metadata hook carry no tiers/palette (reads degrade gracefully —
no placeholder, nothing breaks). Stamp them once with the bundled command:

```sh
payload images:backfill                    # only images missing metadata (idempotent)
payload images:backfill --force            # regenerate every image
payload images:backfill --focal            # also set the saliency focal on docs still at 50/50
payload images:backfill --collection media # a custom source collection
```

`--focal` is opt-in because it changes crops on a live site. New uploads and file replacements
analyze themselves via the upload hook.

**[Documentation →](https://payload-plugins.prolaico.com/docs/plugins/payload-images)**

Ported from [`@pro-laico/images`](https://github.com/pro-laico/atomic-payload) (Atomic Payload, MIT).
