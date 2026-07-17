# @pro-laico/payload-fonts

Custom fonts for [Payload CMS](https://payloadcms.com/) — a Font typeface collection that subsets uploaded files to served WOFF2s, an optional active-font global, and an export endpoint for `next/font/local`.

```bash
pnpm add @pro-laico/payload-fonts
```

**Requires** Payload `^3` and React 19. **Next.js 15+ to serve** — the download CLI writes a `next/font/local` module for your layout; uploading, subsetting, and exporting `.woff2` work in any Payload app.

**[Documentation →](https://payload-plugins.prolaico.com/docs/plugins/payload-fonts)**

## Troubleshooting

**Fonts upload but nothing is served ("the font subsetter failed to load")** — a bundler (Next/Turbopack) inlined the subsetter's wasm/native assets, so `subset-font` can't load at runtime. Keep them external in `next.config`:

```ts
serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit']
```

Ported from [`@pro-laico/fonts`](https://github.com/pro-laico/atomic-payload/tree/main/packages/fonts) (Atomic Payload, MIT).
