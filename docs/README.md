# docs

Documentation site for the Payload Plugins monorepo — a [fumadocs](https://fumadocs.dev/) (Next.js + MDX) app, deployed at [payload-plugins.prolaico.com](https://payload-plugins.prolaico.com).

```bash
pnpm docs        # run locally from the repo root
```

Writing or editing docs? See [STYLE.md](./STYLE.md) for the house style — page structure, naming, quickstart/reference/troubleshooting conventions, and the verify-against-source rule.

Content lives in `content/docs/`; each plugin is a folder (`index.mdx` + task/reference/troubleshooting pages) with a `meta.json` for nav order.
