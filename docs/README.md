# docs

The documentation site for the Payload Plugins monorepo — a [fumadocs](https://fumadocs.dev/)
(Next.js + MDX) app.

```bash
pnpm docs          # from the repo root, or:
pnpm --filter docs dev
```

Runs on [http://localhost:42120](http://localhost:42120).

Content lives in `content/docs/*.mdx`, with sidebar order controlled by `meta.json`
files. Add a page for each plugin under `content/docs/plugins/`.
