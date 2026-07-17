# @pro-laico/payload-icons

SVG icons for [Payload CMS](https://payloadcms.com/) — an Icon upload collection that optimizes and sanitizes every SVG on save, plus an `<Icon name="…" />` server component you seed once with your app's Payload session (`createIcon(getPayload({ config }))`).

```bash
pnpm add @pro-laico/payload-icons
```

**Requires** Payload `^3` and React 19. **Next.js 15+ to render icons** — `<Icon>` reads `draftMode()` and miss-tracking uses `after()`; the collection, admin, and SVG pipeline work in any Payload app.

**[Documentation →](https://payload-plugins.prolaico.com/docs/plugins/payload-icons)**
